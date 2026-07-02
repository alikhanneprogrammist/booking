import {toAlmaty, fromAlmaty, TIMEZONE} from './time';

/** Высота часа в пикселях на таймлайне. 24 ч × 56 = 1344px. */
export const HOUR_PX = 56;
export const DAY_MINUTES = 24 * 60;
export const HOURS = Array.from({length: 24}, (_, i) => i);

/** Инстант начала суток (00:00 Almaty) для даты, на которую попадает instant. */
export function almatyDayStart(instant: Date): Date {
  const w = toAlmaty(instant);
  return fromAlmaty(new Date(w.getFullYear(), w.getMonth(), w.getDate(), 0, 0, 0, 0));
}

/** Сдвиг на n суток с сохранением стеночного времени (Almaty — фикс. оффсет). */
export function addDays(instant: Date, n: number): Date {
  const w = toAlmaty(instant);
  return fromAlmaty(
    new Date(w.getFullYear(), w.getMonth(), w.getDate() + n, w.getHours(), w.getMinutes(), 0, 0),
  );
}

/** Понедельник недели, содержащей instant (00:00 Almaty). */
export function weekStart(instant: Date): Date {
  const start = almatyDayStart(instant);
  const dow = toAlmaty(start).getDay(); // 0=вс…6=сб
  const backToMon = (dow + 6) % 7;
  return addDays(start, -backToMon);
}

/** Минуты от начала суток (может быть <0 или >1440 — для клиппинга). */
export function minutesFromDayStart(instant: Date, dayStart: Date): number {
  return (instant.getTime() - dayStart.getTime()) / 60000;
}

/** Пересечение полуоткрытых интервалов [s,e). */
export function rangesOverlap(aS: Date, aE: Date, bS: Date, bE: Date): boolean {
  return aS < bE && aE > bS;
}

// ─────────────── Календарные строки 'YYYY-MM-DD' (правило «через полночь») ───

/** Следующий календарный день. Общая точка для форм брони (конец ≤ начала → +1 день). */
export function nextDayStr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + 1);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

/** Разница в календарных днях (b − a) между строками 'YYYY-MM-DD'. */
export function dayDiffStr(a: string, b: string): number {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round(
    (new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime()) / 86_400_000,
  );
}

// ───────────────────────── Форматирование (Almaty) ────────────────────

export function fmtTime(instant: Date, locale = 'ru'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(instant);
}

export function fmtDayHeader(instant: Date, locale = 'ru'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(instant);
}

export function fmtWeekday(instant: Date, locale = 'ru'): string {
  return new Intl.DateTimeFormat(locale, {timeZone: TIMEZONE, weekday: 'short'}).format(instant);
}

export function fmtDayNum(instant: Date, locale = 'ru'): string {
  return new Intl.DateTimeFormat(locale, {timeZone: TIMEZONE, day: 'numeric'}).format(instant);
}

export function fmtHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

/** Значение для <input type="datetime-local"> в стеночном времени Almaty. */
export function toLocalInput(instant: Date): string {
  const w = toAlmaty(instant);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${w.getFullYear()}-${p(w.getMonth() + 1)}-${p(w.getDate())}T${p(w.getHours())}:${p(w.getMinutes())}`;
}

/** Обратно: значение input (стеночное Almaty) → UTC-инстант. */
export function fromLocalInput(value: string): Date {
  return fromAlmaty(new Date(value));
}
