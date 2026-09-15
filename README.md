# 🔐 Production Authentication Service (Node.js + PostgreSQL)

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/express-4.19-blue.svg)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-13%2B-blue.svg)](https://www.postgresql.org/)
[![Tests](https://img.shields.io/badge/tests-100%25%20passing-success.svg)](https://jestjs.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A production-grade, hardened authentication microservice built with **Node.js, Express, and PostgreSQL**. Implements industry-standard **JWT access tokens + single-use rotating refresh tokens with token family replay detection**, as used by companies like Razorpay, Zomato, and Stripe.

---

## 🌟 Key Features & Architecture

- **Dual-Token Architecture**:
  - **Access Token**: Short-lived (15 min) JWT carrying user identity claims (`sub`, `email`).
  - **Refresh Token**: Long-lived (7 days) cryptographically random string (256-bit opaque token), stored in PostgreSQL as **SHA-256** hash.
- **Refresh Token Rotation & Compromise Detection**:
  - Every token refresh invalidates the old token and issues a new pair within the same **Token Family (`family_id`)**.
  - If a revoked token is presented again (indicating token theft/replay attack), the service immediately **invalidates all active sessions across the entire token family**.
- **Hardened Cookie Strategy**:
  - Refresh tokens are transmitted strictly via `httpOnly`, `Secure`, `SameSite=Strict` cookies scoped to `path: '/api/auth'`. JavaScript cannot access them, eliminating XSS token theft.
- **Timing Attack Mitigation**:
  - Login uses constant-time bcrypt verification against a `DUMMY_HASH` if the user does not exist, preventing email enumeration.
- **Rate Limiting**:
  - Express rate limiter enforces a maximum of **5 login attempts per 15 minutes per IP** with `trust proxy` configured for reverse proxy / load balancer deployments (Cloudflare, AWS ALB, Nginx).
- **Password Security**:
  - Bcrypt password hashing (12 rounds) with explicit **72-byte max length limit** in Zod to prevent bcrypt's silent input truncation vulnerability.
- **Robust Centralized Error Handling**:
  - Strips stack traces and internal database errors (`PG::UniqueViolation`, etc.) from client responses while providing detailed server logs.

---

## 🏗️ Database Schema

```mermaid
erDiagram
    USERS ||--o{ REFRESH_TOKENS : "has many"
    USERS {
        uuid id PK "gen_random_uuid()"
        varchar email UK "Normalized, unique"
        text password_hash "Bcrypt 12 rounds"
        timestamptz created_at
    }
    REFRESH_TOKENS {
        uuid id PK "gen_random_uuid()"
        uuid user_id FK "REFERENCES users(id) ON DELETE CASCADE"
        text token_hash UK "SHA-256 digest"
        uuid family_id "Lineage tracking"
        boolean revoked "Default false"
        uuid replaced_by FK "REFERENCES refresh_tokens(id)"
        timestamptz expires_at
        timestamptz created_at
        text user_agent
        inet ip_address
    }
```

---

## 📡 API Reference

### 1. Register User
**`POST /api/auth/signup`**

Creates a new user account with hashed credentials.

- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "StrongPassword123!"
  }
  ```
- **Response (`201 Created`):**
  ```json
  {
    "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "email": "user@example.com",
    "created_at": "2026-09-15T12:00:00.000Z"
  }
  ```

---

### 2. User Login
**`POST /api/auth/login`** *(Rate limited: 5 req / 15 min)*

Authenticates credentials, returns an access token, and sets the refresh token cookie.

- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "StrongPassword123!"
  }
  ```
- **Response (`200 OK`):**
  - **Headers**: `Set-Cookie: refreshToken=...; Path=/api/auth; HttpOnly; SameSite=Strict`
  - **Body:**
    ```json
    {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
    ```

---

### 3. Rotate Refresh Token
**`POST /api/auth/refresh`**

Exchanges the current refresh token cookie for a new access token and a new rotated refresh token.

- **Headers:** `Cookie: refreshToken=<token>`
- **Response (`200 OK`):**
  - **Headers**: `Set-Cookie: refreshToken=<new_token>; Path=/api/auth; HttpOnly; SameSite=Strict`
  - **Body:**
    ```json
    {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
    ```

---

### 4. User Logout
**`POST /api/auth/logout`**

Revokes the refresh token in the database and clears the refresh cookie.

- **Headers:** `Cookie: refreshToken=<token>`
- **Response (`200 OK`):**
  - **Headers**: `Set-Cookie: refreshToken=; Path=/api/auth; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
  - **Body:**
    ```json
    {
      "message": "Logged out successfully"
    }
    ```

---

### 5. Get Current User Profile (Protected Route)
**`GET /api/me`** or **`GET /api/auth/me`**

Validates the JWT access token and returns authenticated user details.

- **Headers:** `Authorization: Bearer <accessToken>`
- **Response (`200 OK`):**
  ```json
  {
    "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "email": "user@example.com"
  }
  ```
- **Error Response (`401 Unauthorized`):**
  ```json
  {
    "error": "Access token expired"
  }
  ```

---

## 📁 Project Structure

```
auth-service/
├── .env                              # Environment variables (gitignored)
├── package.json
├── src/
│   ├── app.js                        # Express app configuration & middleware
│   ├── server.js                     # HTTP server startup & graceful shutdown
│   ├── config/
│   │   └── env.js                    # Fail-fast environment variable validation
│   ├── controllers/
│   │   └── auth.controller.js        # Auth logic (signup, login, refresh, logout, me)
│   ├── db/
│   │   ├── index.js                  # PostgreSQL pg connection pool
│   │   └── migrations/
│   │       ├── 001_create_users.sql
│   │       └── 002_create_refresh_tokens.sql
│   ├── middleware/
│   │   ├── auth.middleware.js        # Bearer JWT verification middleware
│   │   ├── errorHandler.middleware.js# Sanitized central error handler
│   │   └── rateLimiter.middleware.js # Express IP rate limiter
│   ├── routes/
│   │   └── auth.routes.js            # Route definitions
│   ├── utils/
│   │   ├── cookies.js                # Cookie options (set & clear)
│   │   ├── password.js               # Bcrypt helpers & dummy hash
│   │   └── tokens.js                 # JWT signing & SHA-256 token generation
│   └── validators/
│       └── auth.validator.js         # Zod schemas (email/password constraints)
└── tests/
    ├── auth.signup.test.js           # Signup unit & integration tests
    ├── auth.login.test.js            # Login tests (success, invalid creds, timing attack)
    ├── auth.refresh.test.js          # Token rotation & replay attack tests
    └── auth.logout.test.js           # Logout & protected route tests
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18 or higher)
- **PostgreSQL** (v13 or higher)

### 2. Installation
```bash
git clone https://github.com/yourusername/auth-service.git
cd auth-service
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory:
```env
NODE_ENV=development
PORT=4000

# PostgreSQL Database Connection
DATABASE_URL=postgresql://postgres:password@localhost:5432/authdb

# JWT Access Token Secret (min 64 random characters)
ACCESS_TOKEN_SECRET=your_super_secret_cryptographically_secure_random_key_here
ACCESS_TOKEN_EXPIRY=15m

# Refresh Token
REFRESH_TOKEN_EXPIRY_DAYS=7

# Cookie Security (set to true in production with HTTPS)
COOKIE_SECURE=false

# Rate Limiting
LOGIN_RATE_LIMIT_WINDOW_MIN=15
LOGIN_RATE_LIMIT_MAX=5

# Bcrypt Work Factor
BCRYPT_ROUNDS=12
```

### 4. Run Migrations
```bash
npm run migrate
```
*(Or execute `src/db/migrations/001_create_users.sql` and `002_create_refresh_tokens.sql` via psql or your DB GUI).*

### 5. Start the Server
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

### 6. Run Automated Tests
```bash
npm test
```

---

## 🛡️ Security Best Practices Implemented

1. **No Tokens in LocalStorage**: Mitigates Cross-Site Scripting (XSS) token extraction.
2. **Hashed Refresh Tokens**: Database compromise does not reveal valid raw refresh tokens.
3. **Replay Detection**: Compromised token reuse immediately purges all sibling tokens in that session family.
4. **Bcrypt 72-Byte Boundary**: Prevents silent truncation attack vectors on passwords.
5. **Constant-Time Responses**: Mitigates user enumeration through response time variance.
6. **Reverse Proxy Ready**: `trust proxy` configured for accurate client IP rate limiting.

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
