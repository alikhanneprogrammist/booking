import {describe, expect, it} from 'vitest';
import {
  kpis, byResource, byEnum, topClients, addonStats,
  prepaymentTotal, byPayment, discountsTotal, byDay, toMonthly, byWeekday,
} from '@/lib/analytics';
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

describe('prepaymentTotal / byPayment', () => {
  it('сумма предоплат и группировка по способу оплаты (revenue = предоплата, не total)', () => {
    const rows = [
      mk({prepayment: 50_000, paymentMethod: 'KASPI', total: 999_999}),
      mk({prepayment: 30_000, paymentMethod: 'KASPI'}),
      mk({prepayment: 20_000, paymentMethod: 'CASH'}),
      mk({prepayment: 10_000}), // без способа → UNKNOWN
    ];
    expect(prepaymentTotal(rows)).toBe(110_000);
    const r = byPayment(rows);
    expect(r[0]).toMatchObject({key: 'KASPI', count: 2, revenue: 80_000});
    expect(r[1]).toMatchObject({key: 'CASH', count: 1, revenue: 20_000});
    expect(r[2]).toMatchObject({key: 'UNKNOWN', count: 1, revenue: 10_000});
  });
});

describe('discountsTotal', () => {
  it('NONE → 0, AMOUNT → как есть, PERCENT восстанавливается от total со скидкой', () => {
    expect(discountsTotal([mk({})])).toBe(0);
    expect(discountsTotal([mk({discountType: 'AMOUNT', discountValue: 20_000})])).toBe(20_000);
    // subtotal 140 000, скидка 10% = 14 000 → total 126 000; восстановление: 126000·10/90 = 14000
    expect(discountsTotal([mk({discountType: 'PERCENT', discountValue: 10, total: 126_000})])).toBe(14_000);
    // PERCENT=100 не восстановить (total 0) — пропускается
    expect(discountsTotal([mk({discountType: 'PERCENT', discountValue: 100, total: 0})])).toBe(0);
  });
});

describe('byDay', () => {
  it('сплошная ось с нулями, дни считаются в Алматы', () => {
    // 2026-07-01T20:00Z = 2026-07-02 01:00 Алматы (+05) → относится ко 2 июля
    const rows = [
      mk({startAt: new Date('2026-07-01T10:00:00Z'), total: 100}),
      mk({startAt: new Date('2026-07-01T20:00:00Z'), total: 50}),
    ];
    const days = byDay(rows, '2026-07-01', '2026-07-03');
    expect(days.map((d) => d.day)).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
    expect(days[0]).toMatchObject({count: 1, revenue: 100});
    expect(days[1]).toMatchObject({count: 1, revenue: 50});
    expect(days[2]).toMatchObject({count: 0, revenue: 0});
  });

  it('toMonthly сворачивает дни в месяцы', () => {
    const days = byDay(
      [mk({startAt: new Date('2026-06-30T10:00:00Z'), total: 10}), mk({startAt: new Date('2026-07-01T10:00:00Z'), total: 20})],
      '2026-06-30',
      '2026-07-01',
    );
    const months = toMonthly(days);
    expect(months).toEqual([
      {day: '2026-06', count: 1, revenue: 10},
      {day: '2026-07', count: 1, revenue: 20},
    ]);
  });
});

describe('byWeekday', () => {
  it('всегда 7 строк в порядке пн…вс', () => {
    // 2026-07-13 — понедельник (Алматы)
    const rows = [
      mk({startAt: new Date('2026-07-13T10:00:00Z'), total: 100}),
      mk({startAt: new Date('2026-07-17T10:00:00Z'), total: 40}), // пятница
    ];
    const r = byWeekday(rows);
    expect(r).toHaveLength(7);
    expect(r.map((x) => x.key)).toEqual(['1', '2', '3', '4', '5', '6', '0']);
    expect(r[0]).toMatchObject({key: '1', count: 1, revenue: 100});
    expect(r[4]).toMatchObject({key: '5', count: 1, revenue: 40});
  });
});
