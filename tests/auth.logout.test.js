const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const db = require('../src/db');
const env = require('../src/config/env');
const { sha256 } = require('../src/utils/tokens');

jest.mock('../src/db');

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should revoke the refresh token in database and clear the cookie', async () => {
    const rawRefreshToken = 'active_refresh_token_to_logout';
    const tokenHash = sha256(rawRefreshToken);

    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', [`refreshToken=${rawRefreshToken}`]);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Logged out successfully');

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1'),
      [tokenHash]
    );

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some((c) => c.startsWith('refreshToken=;'))).toBe(true);
  });

  it('should succeed and clear cookie even if no refresh token cookie was present', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Logged out successfully');
  });
});

describe('GET /api/me (Protected Route)', () => {
  it('should return user info when valid Bearer token is provided', async () => {
    const userId = 'e5eebc99-9c0b-4ef8-bb6d-6bb9bd380a55';
    const email = 'user@example.com';
    const validToken = jwt.sign(
      { sub: userId, email },
      env.accessTokenSecret,
      { expiresIn: '15m' }
    );

    const res = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: userId, email });
  });

  it('should return 401 when Authorization header is missing', async () => {
    const res = await request(app).get('/api/me');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Missing or malformed token');
  });

  it('should return 401 when token is expired', async () => {
    const expiredToken = jwt.sign(
      { sub: 'user-id', email: 'user@example.com' },
      env.accessTokenSecret,
      { expiresIn: '-1s' }
    );

    const res = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Access token expired');
  });

  it('should return 401 when token signature is invalid', async () => {
    const invalidSignatureToken = jwt.sign(
      { sub: 'user-id', email: 'user@example.com' },
      'wrong-secret-key-123',
      { expiresIn: '15m' }
    );

    const res = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${invalidSignatureToken}`);

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid token');
  });
});
