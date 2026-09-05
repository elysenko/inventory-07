import * as request from 'supertest';
import { Role } from '@prisma/client';
import { Harness } from './harness';

describe('Movements (e2e)', () => {
  const harness = new Harness();
  let clerk: string;
  let manager: string;
  let itemId: string;
  let locA: string;
  let locB: string;

  const move = (token: string, body: Record<string, unknown>) =>
    request(harness.server as never)
      .post('/api/movements')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const onHand = async (): Promise<number> => {
    const res = await request(harness.server as never)
      .get(`/api/items/${itemId}`)
      .set('Authorization', `Bearer ${clerk}`)
      .expect(200);
    return res.body.qtyOnHand as number;
  };

  const atLocation = async (locationId: string): Promise<number> => {
    const res = await request(harness.server as never)
      .get(`/api/items/${itemId}`)
      .set('Authorization', `Bearer ${clerk}`)
      .expect(200);
    const row = (res.body.locations as { locationId: string; qty: number }[]).find(
      (entry) => entry.locationId === locationId,
    );
    return row?.qty ?? 0;
  };

  beforeAll(async () => {
    await harness.setup();
    clerk = await harness.signIn(Role.USER);
    manager = await harness.signIn(Role.MANAGER);
    itemId = (await harness.createItem({ reorderAt: 0 })).id;
    locA = (await harness.createLocation('Zone A')).id;
    locB = (await harness.createLocation('Zone B')).id;
  });

  afterAll(async () => {
    await harness.teardown();
  });

  it('credits an IN to the destination', async () => {
    await move(clerk, { type: 'IN', itemId, toLocId: locA, qty: 50 }).expect(201);
    expect(await onHand()).toBe(50);
  });

  it('debits an OUT from the source', async () => {
    await move(clerk, { type: 'OUT', itemId, fromLocId: locA, qty: 20 }).expect(201);
    expect(await onHand()).toBe(30);
  });

  it('moves stock on a TRANSFER without changing the total', async () => {
    await move(clerk, {
      type: 'TRANSFER',
      itemId,
      fromLocId: locA,
      toLocId: locB,
      qty: 10,
    }).expect(201);

    expect(await atLocation(locA)).toBe(20);
    expect(await atLocation(locB)).toBe(10);
    expect(await onHand()).toBe(30);
  });

  it('refuses to oversell and leaves balances and history untouched', async () => {
    const before = await onHand();
    const historyBefore = await harness.prisma.movement.count({ where: { itemId } });

    const res = await move(clerk, {
      type: 'OUT',
      itemId,
      fromLocId: locA,
      qty: 999,
    }).expect(400);
    expect(res.body.message).toBe('Insufficient stock');

    // The whole transaction rolls back: no partial debit, no ledger entry.
    expect(await onHand()).toBe(before);
    expect(await atLocation(locA)).toBe(20);
    expect(await harness.prisma.movement.count({ where: { itemId } })).toBe(
      historyBefore,
    );
  });

  it('enforces the location shape each type requires', async () => {
    await move(clerk, { type: 'IN', itemId, fromLocId: locA, toLocId: locB, qty: 1 }).expect(400);
    await move(clerk, { type: 'OUT', itemId, qty: 1 }).expect(400);
    await move(clerk, { type: 'IN', itemId, qty: 1 }).expect(400);
    await move(clerk, { type: 'TRANSFER', itemId, fromLocId: locA, toLocId: locA, qty: 1 }).expect(400);
    await move(clerk, { type: 'IN', itemId, toLocId: locA, qty: 0 }).expect(400);
    await move(clerk, { type: 'IN', itemId, toLocId: locA, qty: 1.5 }).expect(400);
    await move(clerk, { type: 'IN', itemId: 'does-not-exist', toLocId: locA, qty: 1 }).expect(404);
  });

  it('filters the audit log by item, type and date range', async () => {
    const all = await request(harness.server as never)
      .get(`/api/movements?itemId=${itemId}`)
      .set('Authorization', `Bearer ${manager}`)
      .expect(200);
    expect(all.body.total).toBe(3);
    expect(all.body.pageSize).toBe(50);
    expect(all.body.entries).toHaveLength(3);
    expect(all.body.entries[0]).toMatchObject({
      type: 'TRANSFER',
      qty: 10,
      userEmail: expect.stringContaining('user.'),
    });

    const outs = await request(harness.server as never)
      .get(`/api/movements?itemId=${itemId}&type=OUT`)
      .set('Authorization', `Bearer ${manager}`)
      .expect(200);
    expect(outs.body.total).toBe(1);

    const today = new Date().toISOString().slice(0, 10);
    const inRange = await request(harness.server as never)
      .get(`/api/movements?itemId=${itemId}&from=${today}&to=${today}`)
      .set('Authorization', `Bearer ${manager}`)
      .expect(200);
    expect(inRange.body.total).toBe(3);

    const outOfRange = await request(harness.server as never)
      .get(`/api/movements?itemId=${itemId}&from=1970-01-01&to=1970-01-02`)
      .set('Authorization', `Bearer ${manager}`)
      .expect(200);
    expect(outOfRange.body.total).toBe(0);
  });

  it('pages the audit log 50 at a time', async () => {
    const page2 = await request(harness.server as never)
      .get(`/api/movements?itemId=${itemId}&page=2`)
      .set('Authorization', `Bearer ${manager}`)
      .expect(200);
    expect(page2.body.page).toBe(2);
    expect(page2.body.total).toBe(3);
    expect(page2.body.entries).toHaveLength(0);
  });

  it('exposes an item’s own history to any signed-in user', async () => {
    const res = await request(harness.server as never)
      .get(`/api/movements/item/${itemId}`)
      .set('Authorization', `Bearer ${clerk}`)
      .expect(200);
    expect(res.body).toHaveLength(3);
  });
});
