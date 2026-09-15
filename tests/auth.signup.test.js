const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');

jest.mock('../src/db');

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully register a new user and return user info without password', async () => {
    const mockUser = {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      email: 'test@example.com',
      created_at: new Date().toISOString(),
    };

    // 1. Mock existing check (no user found)
    db.query.mockResolvedValueOnce({ rows: [] });
    // 2. Mock insert query returning user
    db.query.mockResolvedValueOnce({ rows: [mockUser] });

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'Test@Example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id', mockUser.id);
    expect(res.body).toHaveProperty('email', mockUser.email);
    expect(res.body).not.toHaveProperty('password_hash');
    expect(res.body).not.toHaveProperty('password');
  });

  it('should return 400 if email is invalid', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'not-an-email', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Validation failed');
  });

  it('should return 400 if password is shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'user@example.com', password: '123' });

    expect(res.status).toBe(400);
    expect(res.body.details).toContain('Password must be at least 8 characters');
  });

  it('should return 400 if password exceeds 72 characters (bcrypt limit)', async () => {
    const longPassword = 'a'.repeat(73);
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'user@example.com', password: longPassword });

    expect(res.status).toBe(400);
    expect(res.body.details).toContain('Password cannot exceed 72 characters');
  });

  it('should return 409 if user already exists', async () => {
    // Mock user already exists
    db.query.mockResolvedValueOnce({ rows: [{ id: 'existing-id' }] });

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'existing@example.com', password: 'password123' });

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error', 'Unable to create account');
  });

  it('should return 409 if database throws unique violation (error code 23505)', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // initial check passes
    const dbError = new Error('Unique violation');
    dbError.code = '23505';
    db.query.mockRejectedValueOnce(dbError);

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'race@example.com', password: 'password123' });

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error', 'Unable to create account');
  });
});
