import * as request from 'supertest';
import { Role } from '@prisma/client';
import { Harness } from './harness';

describe('Auth (e2e)', () => {
  const harness = new Harness();
  const email = `signup.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.test`;

  beforeAll(async () => {
    await harness.setup();
  });

  afterAll(async () => {
    await harness.prisma.user.deleteMany({ where: { email } });
    await harness.teardown();
  });

  it.each([
    '/api/items',
    '/api/locations',
    '/api/movements',
    '/api/reports/low-stock',
    '/api/admin/settings',
    '/api/auth/me',
  ])('rejects %s without a token', async (path) => {
    await request(harness.server as never)
      .get(path)
      .expect(401);
  });

  it('serves health anonymously', async () => {
    await request(harness.server as never)
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('reports database reachability on the deep check', async () => {
    const res = await request(harness.server as never)
      .get('/api/health/deep')
      .expect(200);
    expect(res.body).toEqual({ status: 'ok', db: 'up' });
  });

  it('signs up, logs in and identifies the caller', async () => {
    const signup = await request(harness.server as never)
      .post('/api/auth/signup')
      .send({ email, password: 'password1234', name: 'New Clerk' })
      .expect(201);
    // Self-service registration must never be able to mint privilege.
    expect(signup.body.user.role).toBe(Role.USER);

    const login = await request(harness.server as never)
      .post('/api/auth/login')
      .send({ email, password: 'password1234' })
      .expect(200);
    expect(login.body.accessToken).toEqual(expect.any(String));

    const me = await request(harness.server as never)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
    expect(me.body.email).toBe(email);
  });

  it('ignores an injected role on signup', async () => {
    const injected = `inject.${email}`;
    const res = await request(harness.server as never)
      .post('/api/auth/signup')
      .send({ email: injected, password: 'password1234', role: Role.ADMIN })
      .expect(201);
    expect(res.body.user.role).toBe(Role.USER);
    await harness.prisma.user.deleteMany({ where: { email: injected } });
  });

  it('rejects a duplicate email with 409', async () => {
    await request(harness.server as never)
      .post('/api/auth/signup')
      .send({ email, password: 'password1234' })
      .expect(409);
  });

  it('rejects a short password with 400', async () => {
    await request(harness.server as never)
      .post('/api/auth/signup')
      .send({ email: `short.${email}`, password: 'short' })
      .expect(400);
  });

  it('rejects a wrong password with 401', async () => {
    await request(harness.server as never)
      .post('/api/auth/login')
      .send({ email, password: 'not-the-password' })
      .expect(401);
  });
});
