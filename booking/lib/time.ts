import {toZonedTime, fromZonedTime} from 'date-fns-tz';
import {getDay, differenceInMinutes} from 'date-fns';

/** Таймзона объекта (ТЗ §5, NFR-5). Хранение — UTC, отображение — Almaty. */
export const TIMEZONE = 'Asia/Almaty';

/** UTC-инстант → локальное время Almaty (для определения дня недели/суток). */
export function toAlmaty(instant: Date): Date {
  return toZonedTime(instant, TIMEZONE);
}

/** Локальное «стеночное» время Almaty → UTC-инстант для хранения. */
export function fromAlmaty(wall: Date): Date {
  return fromZonedTime(wall, TIMEZONE);
}

/**
 * Выходной по правилу ТЗ §4.9: пятница–суббота (по дате начала в Almaty).
 * getDay: 0=вс … 5=пт, 6=сб.
 */
export function isWeekend(instant: Date): boolean {
  const day = getDay(toAlmaty(instant));
  return day === 5 || day === 6;
}

/** Длительность брони в часах (может быть дробной). */
export function durationHours(start: Date, end: Date): number {
  return differenceInMinutes(end, start) / 60;
}

/**
 * Полуоткрытые интервалы [start, end): бронь, кончающаяся в 22:00, и бронь,
 * начинающаяся в 22:00, НЕ пересекаются (ТЗ §4.6, граничное правило).
 */
export function intervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && aEnd > bStart;
}
