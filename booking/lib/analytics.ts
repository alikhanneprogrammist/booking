// Аналитика по бронированиям — чистые агрегации над списком MockBooking.
// Период отбирается на сервере (analytics/page.tsx); сюда приходит уже отобранный список.
// CANCELLED и NO_SHOW («упущенная» выручка) исключаются вызывающим кодом ВЕЗДЕ,
// кроме разбивки по статусам (byEnum 'status'), где они помечаются отдельно.

import type {MockBooking} from './types';
import {toAlmaty} from './time';

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

/** Сумма предоплат (список отбирается по prepaidAt на сервере — деньги по дате получения). */
export function prepaymentTotal(bookings: MockBooking[]): number {
  return bookings.reduce((s, b) => s + b.prepayment, 0);
}

/** Предоплаты по способу оплаты: количество + сумма предоплат, по убыванию суммы. */
export function byPayment(bookings: MockBooking[]): CountRevenue[] {
  const m = new Map<string, CountRevenue>();
  for (const b of bookings) {
    const k = b.paymentMethod ?? 'UNKNOWN';
    const cur = m.get(k) ?? {key: k, count: 0, revenue: 0};
    cur.count += 1;
    cur.revenue += b.prepayment;
    m.set(k, cur);
  }
  return Array.from(m.values()).sort((a, b) => b.revenue - a.revenue);
}

/**
 * Сумма скидок за период. total хранится уже СО скидкой (total = subtotal − скидка),
 * поэтому PERCENT восстанавливаем обратным ходом: скидка = total·pct/(100−pct).
 * PERCENT=100 восстановить нельзя (total=0) — пропускаем.
 */
export function discountsTotal(bookings: MockBooking[]): number {
  let sum = 0;
  for (const b of bookings) {
    if (b.discountType === 'AMOUNT') sum += b.discountValue;
    else if (b.discountType === 'PERCENT' && b.discountValue > 0 && b.discountValue < 100) {
      sum += (b.total * b.discountValue) / (100 - b.discountValue);
    }
  }
  return Math.round(sum);
}

export interface DayPoint {
  day: string; // YYYY-MM-DD (день Алматы) или YYYY-MM после toMonthly
  count: number;
  revenue: number;
}

/**
 * Динамика по дням Алматы: сплошная ось fromISO..toISO (обе границы включительно,
 * формат YYYY-MM-DD), дни без событий — нулями.
 */
export function pointsByDay(
  items: Array<{at: Date; value: number}>,
  fromISO: string,
  toISO: string,
): DayPoint[] {
  const m = new Map<string, DayPoint>();
  for (const it of items) {
    const w = toAlmaty(it.at);
    const k = `${w.getFullYear()}-${String(w.getMonth() + 1).padStart(2, '0')}-${String(w.getDate()).padStart(2, '0')}`;
    const cur = m.get(k) ?? {day: k, count: 0, revenue: 0};
    cur.count += 1;
    cur.revenue += it.value;
    m.set(k, cur);
  }
  const out: DayPoint[] = [];
  // Шагаем по календарным дням в UTC — строки дат без таймзонных сюрпризов.
  let cur = new Date(`${fromISO}T00:00:00Z`);
  const end = new Date(`${toISO}T00:00:00Z`);
  for (let guard = 0; cur <= end && guard < 3700; guard += 1) {
    const key = cur.toISOString().slice(0, 10);
    out.push(m.get(key) ?? {day: key, count: 0, revenue: 0});
    cur = new Date(cur.getTime() + 86_400_000);
  }
  return out;
}

/** Динамика броней по дням — обёртка над pointsByDay (startAt/total). */
export function byDay(bookings: MockBooking[], fromISO: string, toISO: string): DayPoint[] {
  return pointsByDay(bookings.map((b) => ({at: b.startAt, value: b.total})), fromISO, toISO);
}

/** Свёртка дневных точек в месячные (для периодов длиннее ~3 месяцев). */
export function toMonthly(days: DayPoint[]): DayPoint[] {
  const m = new Map<string, DayPoint>();
  for (const d of days) {
    const k = d.day.slice(0, 7);
    const cur = m.get(k) ?? {day: k, count: 0, revenue: 0};
    cur.count += d.count;
    cur.revenue += d.revenue;
    m.set(k, cur);
  }
  return Array.from(m.values());
}

/** По дням недели (Алматы), всегда 7 строк в порядке пн…вс; key = getDay() ('1'…'6','0'). */
export function byWeekday(bookings: MockBooking[]): CountRevenue[] {
  const m = new Map<string, CountRevenue>();
  for (const b of bookings) {
    const k = String(toAlmaty(b.startAt).getDay());
    const cur = m.get(k) ?? {key: k, count: 0, revenue: 0};
    cur.count += 1;
    cur.revenue += b.total;
    m.set(k, cur);
  }
  return ['1', '2', '3', '4', '5', '6', '0'].map((k) => m.get(k) ?? {key: k, count: 0, revenue: 0});
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
