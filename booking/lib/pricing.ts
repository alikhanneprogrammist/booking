import {durationHours, isWeekend} from './time';

/**
 * Авторасчёт стоимости (ТЗ §4.9). Чистая функция, без БД — тестируема.
 * Даёт ПРЕДВАРИТЕЛЬНУЮ сумму; администратор правит итог и депозит вручную
 * (FR-PRICE-3). Тарифы караоке часто = депозит по кухне/бару.
 */

import type {Tariff, DiscountType} from './enums';

// Ре-экспорт для существующих импортов из pricing (типы живут в lib/enums.ts).
export type {Tariff, DiscountType};

/** Скидка по брони: тип и значение (% либо фикс. сумма ₸). */
export interface Discount {
  type: DiscountType;
  value: number;
}

/** Сумма скидки в ₸ от подытога (≤ подытога, ≥ 0). */
export function discountAmountFor(subtotal: number, discount?: Discount): number {
  if (!discount || discount.value <= 0 || discount.type === 'NONE') return 0;
  const raw =
    discount.type === 'PERCENT'
      ? (subtotal * Math.min(discount.value, 100)) / 100
      : discount.value;
  return Math.round(Math.min(Math.max(raw, 0), subtotal) * 100) / 100;
}

/** Числовой срез тарифов объекта (Prisma Decimal → number у вызывающего). */
export interface PricingResource {
  hourlyPrice: number;
  minHours: number;
  halfDayPrice: number | null;
  fullDayPrice: number | null;
  weekendPrice: number | null;
  weekdayMinDeposit: number | null;
  capacity: number;
}

export interface AddonLine {
  price: number;
  qty: number;
}

export interface PriceResult {
  hours: number;
  weekend: boolean;
  tariffAmount: number;
  addonsAmount: number;
  subtotal: number; // тариф + доп.услуги, до скидки
  discountAmount: number; // применённая скидка в ₸
  total: number; // итог = subtotal − discountAmount (≥ 0)
  suggestedDeposit: number;
  warnings: string[];
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computePrice(
  resource: PricingResource,
  tariff: Tariff,
  start: Date,
  end: Date,
  addons: AddonLine[] = [],
  guests?: number,
  discount?: Discount,
): PriceResult {
  const hours = durationHours(start, end);
  const weekend = isWeekend(start);
  const warnings: string[] = [];

  let tariffAmount = 0;
  switch (tariff) {
    case 'HOURLY': {
      // Биллинг минимум minHours часов (ТЗ §4.9: почасовой, минимум 3).
      const billable = Math.max(hours, resource.minHours);
      tariffAmount = resource.hourlyPrice * billable;
      break;
    }
    case 'HALF_DAY':
      tariffAmount = resource.halfDayPrice ?? 0;
      if (resource.halfDayPrice == null) warnings.push('Тариф «полусутки» не задан у объекта');
      break;
    case 'FULL_DAY':
      tariffAmount = resource.fullDayPrice ?? 0;
      if (resource.fullDayPrice == null) warnings.push('Тариф «сутки» не задан у объекта');
      break;
    case 'WEEKEND':
      tariffAmount = resource.weekendPrice ?? 0;
      if (resource.weekendPrice == null) warnings.push('Тариф выходного дня не задан у объекта');
      break;
    case 'CUSTOM':
      tariffAmount = 0; // вводится вручную
      break;
  }

  const addonsAmount = addons.reduce((s, a) => s + a.price * a.qty, 0);
  const subtotal = round(tariffAmount + addonsAmount);
  const discountAmount = discountAmountFor(subtotal, discount);

  // Предв. депозит: в будни — минимальный депозит по кухне/бару, если задан.
  const suggestedDeposit = !weekend && resource.weekdayMinDeposit != null
    ? resource.weekdayMinDeposit
    : 0;

  if (guests != null && guests > resource.capacity) {
    warnings.push(`Гостей (${guests}) больше вместимости объекта (${resource.capacity})`);
  }

  return {
    hours: round(hours),
    weekend,
    tariffAmount: round(tariffAmount),
    addonsAmount: round(addonsAmount),
    subtotal,
    discountAmount,
    total: round(Math.max(0, subtotal - discountAmount)),
    suggestedDeposit: round(suggestedDeposit),
    warnings,
  };
}
