// Единый источник enum-значений домена: значения-массивы (для select/легенд)
// и производные типы. Должны совпадать с enum'ами prisma/schema.prisma —
// расхождение ловится компилятором в lib/queries.ts (маппинг Prisma → DTO).

export const TARIFFS = ['HOURLY', 'HALF_DAY', 'FULL_DAY', 'WEEKEND', 'CUSTOM'] as const;
export type Tariff = (typeof TARIFFS)[number];

export const DISCOUNT_TYPES = ['NONE', 'PERCENT', 'AMOUNT'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const BOOKING_STATUSES = [
  'NEW', 'CONFIRMED', 'PREPAID', 'ARRIVED', 'COMPLETED', 'CANCELLED', 'NO_SHOW',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_SOURCES = [
  'ADMIN', 'PHONE', 'WHATSAPP', 'INSTAGRAM', 'WIDGET',
  'TWO_GIS', 'GOOGLE_SITE', 'REGULAR', 'RETURNING', 'REFERRAL',
  'AGENT', 'OUTDOOR_AD', 'BLOGGERS', 'B2B', 'BI_KMG_QAZGAZ',
] as const;
export type BookingSource = (typeof BOOKING_SOURCES)[number];

export const PAYMENT_METHODS = ['KASPI', 'CASH', 'BANK', 'CASH_KASPI'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const ROLES = ['ADMIN', 'MANAGER'] as const;
export type Role = (typeof ROLES)[number];
