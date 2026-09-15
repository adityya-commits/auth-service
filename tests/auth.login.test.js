const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../src/app');
const db = require('../src/db');

jest.mock('../src/db');

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should authenticate valid credentials, return accessToken, and set refreshToken cookie', async () => {
    const plainPassword = 'CorrectPassword123!';
    const passwordHash = await bcrypt.hash(plainPassword, 10);
    const mockUser = {
      id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      email: 'user@example.com',
      password_hash: passwordHash,
    };

    // 1. Mock finding user
    db.query.mockResolvedValueOnce({ rows: [mockUser] });
    // 2. Mock inserting refresh token
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: plainPassword });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(typeof res.body.accessToken).toBe('string');

    // Verify Set-Cookie header contains refreshToken
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
    expect(cookies.some((c) => c.includes('HttpOnly'))).toBe(true);
    expect(cookies.some((c) => c.includes('Path=/api/auth'))).toBe(true);
  });

  it('should return 401 for incorrect password', async () => {
    const passwordHash = await bcrypt.hash('CorrectPassword123!', 10);
    const mockUser = {
      id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      email: 'user@example.com',
      password_hash: passwordHash,
    };

    db.query.mockResolvedValueOnce({ rows: [mockUser] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'WrongPassword' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid credentials');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('should return 401 if user does not exist (mitigating timing attacks with dummy hash)', async () => {
    // User not found in DB
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nonexistent@example.com', password: 'anyPassword123' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid credentials');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('should return 400 if validation fails (e.g. missing password)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Validation failed');
  });
});
