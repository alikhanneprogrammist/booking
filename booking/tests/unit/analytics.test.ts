import {describe, expect, it} from 'vitest';
import {kpis, byResource, byEnum, topClients, addonStats} from '@/lib/analytics';
import type {MockBooking} from '@/lib/types';

let seq = 0;
function mk(over: Partial<MockBooking>): MockBooking {
  seq += 1;
  return {
    id: `b-${seq}`,
    resourceId: 'r-1',
    clientId: 'c-1',
    startAt: new Date('2026-07-01T10:00:00Z'),
    endAt: new Date('2026-07-01T14:00:00Z'),
    status: 'CONFIRMED',
    source: 'ADMIN',
    tariff: 'HOURLY',
    guests: 2,
    total: 100_000,
    deposit: 0,
    prepayment: 0,
    discountType: 'NONE',
    discountValue: 0,
    addons: [],
    ...over,
  };
}

describe('kpis', () => {
  it('count/revenue/guests/avgCheck', () => {
    const k = kpis([mk({total: 100_000, guests: 2}), mk({total: 50_000, guests: 3})]);
    expect(k).toEqual({count: 2, revenue: 150_000, guests: 5, avgCheck: 75_000});
  });
  it('пустой список — без деления на ноль', () => {
    expect(kpis([]).avgCheck).toBe(0);
  });
  it('средний чек округляется', () => {
    expect(kpis([mk({total: 100}), mk({total: 101}), mk({total: 101})]).avgCheck).toBe(101);
  });
});

describe('byResource / byEnum', () => {
  const rows = [
    mk({resourceId: 'r-1', total: 100, status: 'NEW'}),
    mk({resourceId: 'r-2', total: 300, status: 'NEW'}),
    mk({resourceId: 'r-1', total: 50, status: 'CANCELLED'}),
  ];
  it('byResource: группировка и сортировка по выручке', () => {
    const r = byResource(rows);
    expect(r.map((x) => x.key)).toEqual(['r-2', 'r-1']);
    expect(r[1]).toMatchObject({count: 2, revenue: 150});
  });
  it('byEnum status: сортировка по количеству', () => {
    const r = byEnum(rows, 'status');
    expect(r[0]).toMatchObject({key: 'NEW', count: 2});
    expect(r[1]).toMatchObject({key: 'CANCELLED', count: 1});
  });
});

describe('topClients', () => {
  it('топ по выручке, ограничение n', () => {
    const rows = [
      mk({clientId: 'a', total: 10}),
      mk({clientId: 'b', total: 100}),
      mk({clientId: 'c', total: 50}),
    ];
    expect(topClients(rows, 2).map((c) => c.clientId)).toEqual(['b', 'c']);
  });
});

describe('addonStats', () => {
  it('qty и выручка по цене на момент брони', () => {
    const rows = [
      mk({addons: [{addonId: 'x', qty: 2, priceAtBooking: 15_000}]}),
      mk({addons: [{addonId: 'x', qty: 1, priceAtBooking: 10_000}, {addonId: 'y', qty: 1, priceAtBooking: 99_000}]}),
    ];
    const r = addonStats(rows);
    expect(r[0]).toMatchObject({addonId: 'y', qty: 1, revenue: 99_000});
    expect(r[1]).toMatchObject({addonId: 'x', qty: 3, revenue: 40_000});
  });
});
