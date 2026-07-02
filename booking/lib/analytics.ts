// Аналитика по бронированиям — чистые агрегации над списком MockBooking.
// Период отбирается на сервере (analytics/page.tsx); сюда приходит уже отобранный список.
// CANCELLED и NO_SHOW («упущенная» выручка) исключаются вызывающим кодом ВЕЗДЕ,
// кроме разбивки по статусам (byEnum 'status'), где они помечаются отдельно.

import type {MockBooking} from './mock-data';

export interface Kpis {
  count: number;
  revenue: number;
  avgCheck: number;
  guests: number;
}

export function kpis(bookings: MockBooking[]): Kpis {
  const count = bookings.length;
  const revenue = bookings.reduce((s, b) => s + b.total, 0);
  const guests = bookings.reduce((s, b) => s + b.guests, 0);
  return {count, revenue, guests, avgCheck: count ? Math.round(revenue / count) : 0};
}

export interface CountRevenue {
  key: string;
  count: number;
  revenue: number;
}

/** Брони по объекту (какие VIP брали): count + выручка, по убыванию выручки. */
export function byResource(bookings: MockBooking[]): CountRevenue[] {
  return groupCountRevenue(bookings, (b) => b.resourceId);
}

/** Разбивка по enum-полю (status/source/tariff): count + выручка, по убыванию count. */
export function byEnum(
  bookings: MockBooking[],
  key: 'status' | 'source' | 'tariff',
): CountRevenue[] {
  return groupCountRevenue(bookings, (b) => b[key] as string).sort((a, b) => b.count - a.count);
}

export interface TopClient {
  clientId: string;
  count: number;
  revenue: number;
}

/** Топ клиентов по выручке. */
export function topClients(bookings: MockBooking[], n = 5): TopClient[] {
  return groupCountRevenue(bookings, (b) => b.clientId)
    .slice(0, n)
    .map((g) => ({clientId: g.key, count: g.count, revenue: g.revenue}));
}

export interface AddonStat {
  addonId: string;
  qty: number;
  revenue: number;
}

/** Популярность доп.услуг: суммарное количество и выручка (qty·priceAtBooking), по убыванию выручки. */
export function addonStats(bookings: MockBooking[]): AddonStat[] {
  const m = new Map<string, AddonStat>();
  for (const b of bookings) {
    for (const a of b.addons) {
      const cur = m.get(a.addonId) ?? {addonId: a.addonId, qty: 0, revenue: 0};
      cur.qty += a.qty;
      cur.revenue += a.qty * a.priceAtBooking;
      m.set(a.addonId, cur);
    }
  }
  return Array.from(m.values()).sort((x, y) => y.revenue - x.revenue);
}

// ───────────────────────── helpers ─────────────────────────

function groupCountRevenue(
  bookings: MockBooking[],
  keyOf: (b: MockBooking) => string,
): CountRevenue[] {
  const m = new Map<string, CountRevenue>();
  for (const b of bookings) {
    const k = keyOf(b);
    const cur = m.get(k) ?? {key: k, count: 0, revenue: 0};
    cur.count += 1;
    cur.revenue += b.total;
    m.set(k, cur);
  }
  return Array.from(m.values()).sort((a, b) => b.revenue - a.revenue);
}
