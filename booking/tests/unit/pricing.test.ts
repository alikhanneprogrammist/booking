import {describe, expect, it} from 'vitest';
import {computePrice, discountAmountFor, type PricingResource} from '@/lib/pricing';
import {fromAlmaty} from '@/lib/time';

const RES: PricingResource = {
  hourlyPrice: 25_000,
  minHours: 3,
  halfDayPrice: 120_000,
  fullDayPrice: 175_000,
  weekendPrice: 200_000,
  weekdayMinDeposit: 50_000,
  capacity: 10,
};

// Среда 1 июля 2026 (будни) и пятница 3 июля (выходной по ТЗ).
const wed = (h: number) => fromAlmaty(new Date(2026, 6, 1, h));
const fri = (h: number) => fromAlmaty(new Date(2026, 6, 3, h));

describe('computePrice — тарифы', () => {
  it('HOURLY будни: 4 часа × 25 000', () => {
    const p = computePrice(RES, 'HOURLY', wed(10), wed(14));
    expect(p.total).toBe(100_000);
    expect(p.weekend).toBe(false);
    expect(p.suggestedDeposit).toBe(50_000); // будний мин. депозит
  });

  it('HOURLY меньше минимума: биллинг по minHours', () => {
    const p = computePrice(RES, 'HOURLY', wed(10), wed(12)); // 2 ч < 3
    expect(p.total).toBe(75_000);
  });

  it('HALF_DAY / FULL_DAY / WEEKEND — фиксированные суммы', () => {
    expect(computePrice(RES, 'HALF_DAY', wed(10), wed(22)).total).toBe(120_000);
    expect(computePrice(RES, 'FULL_DAY', wed(10), wed(23)).total).toBe(175_000);
    expect(computePrice(RES, 'WEEKEND', fri(10), fri(20)).total).toBe(200_000);
  });

  it('незаданный тариф → 0 + предупреждение', () => {
    const p = computePrice({...RES, fullDayPrice: null}, 'FULL_DAY', wed(10), wed(22));
    expect(p.tariffAmount).toBe(0);
    expect(p.warnings.length).toBeGreaterThan(0);
  });

  it('CUSTOM: тариф 0, считаются только доп-услуги', () => {
    const p = computePrice(RES, 'CUSTOM', wed(10), wed(14), [{price: 15_000, qty: 2}]);
    expect(p.total).toBe(30_000);
  });

  it('выходной: депозит будней не подставляется', () => {
    expect(computePrice(RES, 'HOURLY', fri(10), fri(14)).suggestedDeposit).toBe(0);
  });
});

describe('computePrice — доп-услуги, скидки, вместимость', () => {
  it('доп-услуги суммируются qty × price', () => {
    const p = computePrice(RES, 'HOURLY', wed(10), wed(14), [
      {price: 15_000, qty: 2},
      {price: 20_000, qty: 1},
    ]);
    expect(p.addonsAmount).toBe(50_000);
    expect(p.total).toBe(150_000);
  });

  it('скидка PERCENT: 10% от подытога', () => {
    const p = computePrice(RES, 'HOURLY', wed(10), wed(14), [], 2, {type: 'PERCENT', value: 10});
    expect(p.subtotal).toBe(100_000);
    expect(p.discountAmount).toBe(10_000);
    expect(p.total).toBe(90_000);
  });

  it('скидка AMOUNT не уводит итог в минус', () => {
    const p = computePrice(RES, 'HOURLY', wed(10), wed(14), [], 2, {type: 'AMOUNT', value: 999_999});
    expect(p.total).toBe(0);
  });

  it('гостей больше вместимости → предупреждение, не блок', () => {
    const p = computePrice(RES, 'HOURLY', wed(10), wed(14), [], 25);
    expect(p.warnings.some((w) => w.includes('вместимости'))).toBe(true);
    expect(p.total).toBe(100_000);
  });
});

describe('discountAmountFor', () => {
  it('NONE/нулевая/отрицательная → 0', () => {
    expect(discountAmountFor(100_000)).toBe(0);
    expect(discountAmountFor(100_000, {type: 'NONE', value: 50})).toBe(0);
    expect(discountAmountFor(100_000, {type: 'PERCENT', value: 0})).toBe(0);
    expect(discountAmountFor(100_000, {type: 'AMOUNT', value: -5})).toBe(0);
  });
  it('PERCENT клампится к 100', () => {
    expect(discountAmountFor(100_000, {type: 'PERCENT', value: 150})).toBe(100_000);
  });
  it('AMOUNT клампится к подытогу', () => {
    expect(discountAmountFor(100_000, {type: 'AMOUNT', value: 120_000})).toBe(100_000);
  });
});
