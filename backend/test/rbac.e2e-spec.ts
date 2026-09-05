import * as request from 'supertest';
import { Role } from '@prisma/client';
import { Harness } from './harness';

describe('Role-based access (e2e)', () => {
  const harness = new Harness();
  let clerk: string;
  let manager: string;
  let admin: string;

  beforeAll(async () => {
    await harness.setup();
    clerk = await harness.signIn(Role.USER);
    manager = await harness.signIn(Role.MANAGER);
    admin = await harness.signIn(Role.ADMIN);
  });

  afterAll(async () => {
    await harness.prisma.item.deleteMany({
      where: { sku: { startsWith: `RBAC-${harness.run}` } },
    });
    await harness.teardown();
  });

  it('denies a clerk write access to the catalogue', async () => {
    await request(harness.server as never)
      .post('/api/items')
      .set('Authorization', `Bearer ${clerk}`)
      .send({ sku: `RBAC-${harness.run}-x`, name: 'Nope' })
      .expect(403);
  });

  it('denies a clerk the audit log and the low-stock report', async () => {
    await request(harness.server as never)
      .get('/api/movements')
      .set('Authorization', `Bearer ${clerk}`)
      .expect(403);
    await request(harness.server as never)
      .get('/api/reports/low-stock')
      .set('Authorization', `Bearer ${clerk}`)
      .expect(403);
  });

  it('lets a clerk read the catalogue and the locations', async () => {
    await request(harness.server as never)
      .get('/api/items')
      .set('Authorization', `Bearer ${clerk}`)
      .expect(200);
    await request(harness.server as never)
      .get('/api/locations')
      .set('Authorization', `Bearer ${clerk}`)
      .expect(200);
  });

  it('lets a manager create an item and rejects a duplicate SKU', async () => {
    const sku = `RBAC-${harness.run}-dup`;
    await request(harness.server as never)
      .post('/api/items')
      .set('Authorization', `Bearer ${manager}`)
      .send({ sku, name: 'Original' })
      .expect(201);

    const duplicate = await request(harness.server as never)
      .post('/api/items')
      .set('Authorization', `Bearer ${manager}`)
      .send({ sku, name: 'Clash' })
      .expect(400);
    expect(duplicate.body.message).toBe('SKU already exists');
  });

  it('treats ADMIN as satisfying a MANAGER requirement', async () => {
    await request(harness.server as never)
      .get('/api/movements')
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);
  });

  it('reserves the settings screen for ADMIN alone', async () => {
    await request(harness.server as never)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${manager}`)
      .expect(403);
    await request(harness.server as never)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);
  });
});
