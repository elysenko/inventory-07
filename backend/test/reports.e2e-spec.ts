import * as request from 'supertest';
import { Role } from '@prisma/client';
import { Harness } from './harness';

interface LowStockRow {
  itemId: string;
  onHand: number;
  reorderAt: number;
  deficit: number;
}

describe('Low-stock report (e2e)', () => {
  const harness = new Harness();
  let clerk: string;
  let manager: string;
  let lowItem: string;
  let healthyItem: string;
  let emptyItem: string;
  let location: string;

  const rowsFor = async (): Promise<LowStockRow[]> => {
    const res = await request(harness.server as never)
      .get('/api/reports/low-stock')
      .set('Authorization', `Bearer ${manager}`)
      .expect(200);
    const mine = new Set([lowItem, healthyItem, emptyItem]);
    return (res.body as LowStockRow[]).filter((row) => mine.has(row.itemId));
  };

  beforeAll(async () => {
    await harness.setup();
    clerk = await harness.signIn(Role.USER);
    manager = await harness.signIn(Role.MANAGER);
    location = (await harness.createLocation('Zone A')).id;

    lowItem = (await harness.createItem({ reorderAt: 10 })).id;
    healthyItem = (await harness.createItem({ reorderAt: 10 })).id;
    emptyItem = (await harness.createItem({ reorderAt: 5 })).id;

    const receive = (itemId: string, qty: number) =>
      request(harness.server as never)
        .post('/api/movements')
        .set('Authorization', `Bearer ${clerk}`)
        .send({ type: 'IN', itemId, toLocId: location, qty })
        .expect(201);

    await receive(lowItem, 12);
    await receive(healthyItem, 40);
  });

  afterAll(async () => {
    await harness.teardown();
  });

  it('excludes an item comfortably above its threshold', async () => {
    const rows = await rowsFor();
    expect(rows.map((row) => row.itemId)).not.toContain(healthyItem);
  });

  it('includes an item that never had stock as on hand zero', async () => {
    const rows = await rowsFor();
    expect(rows.find((row) => row.itemId === emptyItem)).toMatchObject({
      onHand: 0,
      reorderAt: 5,
      deficit: 5,
    });
  });

  it('includes an item once an OUT drops it to its threshold', async () => {
    await request(harness.server as never)
      .post('/api/movements')
      .set('Authorization', `Bearer ${clerk}`)
      .send({ type: 'OUT', itemId: lowItem, fromLocId: location, qty: 5 })
      .expect(201);

    const rows = await rowsFor();
    expect(rows.find((row) => row.itemId === lowItem)).toMatchObject({
      onHand: 7,
      reorderAt: 10,
      deficit: 3,
    });
  });

  it('orders by deficit, worst first', async () => {
    const deficits = (await rowsFor()).map((row) => row.deficit);
    expect(deficits).toEqual([...deficits].sort((a, b) => b - a));
  });
});
