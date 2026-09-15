const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const { sha256 } = require('../src/utils/tokens');

jest.mock('../src/db');

describe('POST /api/auth/refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully rotate refresh token and return new access token', async () => {
    const rawRefreshToken = 'valid_raw_refresh_token_string_32_bytes_long';
    const tokenHash = sha256(rawRefreshToken);
    const familyId = 'c3eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
    const userId = 'd4eebc99-9c0b-4ef8-bb6d-6bb9bd380a44';

    const mockTokenRecord = {
      id: 'token-row-id-1',
      user_id: userId,
      token_hash: tokenHash,
      family_id: familyId,
      revoked: false,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const mockUser = {
      id: userId,
      email: 'user@example.com',
    };

    // 1. Mock finding token record
    db.query.mockResolvedValueOnce({ rows: [mockTokenRecord] });
    // 2. Mock finding user
    db.query.mockResolvedValueOnce({ rows: [mockUser] });
    // 3. Mock updating old token to revoked
    db.query.mockResolvedValueOnce({ rows: [] });
    // 4. Mock inserting new token in issueTokenPair
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${rawRefreshToken}`]);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(typeof res.body.accessToken).toBe('string');

    // Check that a new cookie is set
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
  });

  it('should return 401 if no refresh token cookie is provided', async () => {
    const res = await request(app).post('/api/auth/refresh');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'No refresh token provided');
  });

  it('should return 401 if refresh token is not found in database', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', ['refreshToken=non_existent_token']);

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid refresh token');
  });

  it('should detect token reuse (replay attack), invalidate the whole token family, clear cookie, and return 401', async () => {
    const rawRefreshToken = 'compromised_already_revoked_token';
    const tokenHash = sha256(rawRefreshToken);
    const familyId = 'c3eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';

    const mockRevokedRecord = {
      id: 'token-row-id-old',
      user_id: 'user-id',
      token_hash: tokenHash,
      family_id: familyId,
      revoked: true, // ALREADY REVOKED!
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    // 1. Mock finding token record (which is revoked)
    db.query.mockResolvedValueOnce({ rows: [mockRevokedRecord] });
    // 2. Mock revoking entire family
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${rawRefreshToken}`]);

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Token reuse detected');

    // Ensure family was invalidated in DB
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE refresh_tokens SET revoked = true WHERE family_id = $1'),
      [familyId]
    );

    // Verify cookie was cleared
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some((c) => c.startsWith('refreshToken=;'))).toBe(true);
  });

  it('should return 401 if refresh token has expired', async () => {
    const rawRefreshToken = 'expired_token';
    const tokenHash = sha256(rawRefreshToken);

    const mockExpiredRecord = {
      id: 'token-row-id-expired',
      user_id: 'user-id',
      token_hash: tokenHash,
      family_id: 'family-id',
      revoked: false,
      expires_at: new Date(Date.now() - 1000).toISOString(), // expired in past
    };

    db.query.mockResolvedValueOnce({ rows: [mockExpiredRecord] });

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${rawRefreshToken}`]);

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Refresh token expired');
  });
});
