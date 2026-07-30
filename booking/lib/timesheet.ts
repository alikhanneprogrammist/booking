// Чистая логика вкладки «Табель» (без БД, покрыта scripts/test-domain.ts):
// дни месяца со стеночными выходными пт/сб, итоги по строке сотрудника,
// разбор параметра месяца ?m=YYYY-MM.

export const TIMESHEET_MODES = ['plan', 'fact'] as const;
export type TimesheetMode = (typeof TIMESHEET_MODES)[number];

/** Строка табеля: сотрудник + его часы по дням месяца (день → часы). */
export interface TimesheetEmployee {
  id: string;
  name: string;
  position: string;
  department: string;
  schedule: string | null;
  shiftHours: number | null;
  workPattern: string | null;
  isActive: boolean;
  sortOrder: number;
  plan: Record<number, number>;
  fact: Record<number, number>;
}

export interface MonthDay {
  day: number; // 1..31
  weekday: number; // 0=вс … 6=сб (как getUTCDay)
  isWeekend: boolean; // выходные заведения — пт/сб
}

/** Дни месяца (стеночные даты Алматы). month: 1..12. */
export function monthDays(year: number, month: number): MonthDay[] {
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({length: count}, (_, i) => {
    const weekday = new Date(Date.UTC(year, month - 1, i + 1)).getUTCDay();
    return {day: i + 1, weekday, isWeekend: weekday === 5 || weekday === 6};
  });
}

/** Итог по строке: сколько дней в смене и часов всего (нули не считаются). */
export function rowTotals(hours: Record<number, number>): {days: number; hours: number} {
  const vals = Object.values(hours).filter((h) => h > 0);
  return {days: vals.length, hours: vals.reduce((s, h) => s + h, 0)};
}

/** Сколько человек в смене в конкретный день. */
export function headcount(rows: TimesheetEmployee[], mode: TimesheetMode, day: number): number {
  return rows.filter((r) => (r[mode][day] ?? 0) > 0).length;
}

const MONTH_RE = /^(\d{4})-(\d{2})$/;

/** Разбор ?m=YYYY-MM; мусор или выход за 2020..2100 → месяц даты fallback. */
export function parseMonthParam(
  m: string | undefined,
  fallback: {year: number; month: number},
): {year: number; month: number} {
  const match = MONTH_RE.exec(m ?? '');
  if (!match) return fallback;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 2020 || year > 2100 || month < 1 || month > 12) return fallback;
  return {year, month};
}

/** Ключ месяца для URL: 2026-07. */
export function monthParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Месяц со сдвигом на delta (для навигации ←/→). */
export function shiftMonth(year: number, month: number, delta: number): {year: number; month: number} {
  const total = year * 12 + (month - 1) + delta;
  return {year: Math.floor(total / 12), month: (total % 12 + 12) % 12 + 1};
}
