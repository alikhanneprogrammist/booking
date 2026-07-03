import {describe, expect, it} from 'vitest';
import {
  nextDayStr, dayDiffStr, rangesOverlap, almatyDayStart, addDays, weekStart,
  toLocalInput, fromLocalInput,
} from '@/lib/calendar';
import {fromAlmaty, toAlmaty} from '@/lib/time';

describe('nextDayStr', () => {
  it('обычный день, конец месяца, конец года', () => {
    expect(nextDayStr('2026-07-03')).toBe('2026-07-04');
    expect(nextDayStr('2026-07-31')).toBe('2026-08-01');
    expect(nextDayStr('2026-12-31')).toBe('2027-01-01');
  });
  it('февраль: невисокосный и високосный', () => {
    expect(nextDayStr('2026-02-28')).toBe('2026-03-01');
    expect(nextDayStr('2028-02-28')).toBe('2028-02-29');
  });
});

describe('dayDiffStr', () => {
  it('0, +1, многодневная, отрицательная', () => {
    expect(dayDiffStr('2026-07-03', '2026-07-03')).toBe(0);
    expect(dayDiffStr('2026-07-03', '2026-07-04')).toBe(1);
    expect(dayDiffStr('2026-07-03', '2026-07-06')).toBe(3);
    expect(dayDiffStr('2026-07-03', '2026-07-01')).toBe(-2);
  });
  it('через границу месяца', () => {
    expect(dayDiffStr('2026-06-30', '2026-07-02')).toBe(2);
  });
});

describe('rangesOverlap — полуоткрытые', () => {
  const d = (h: number) => new Date(Date.UTC(2026, 6, 3, h));
  it('касание — не пересечение, перекрытие — пересечение', () => {
    expect(rangesOverlap(d(10), d(12), d(12), d(14))).toBe(false);
    expect(rangesOverlap(d(10), d(13), d(12), d(14))).toBe(true);
  });
});

describe('almatyDayStart / addDays / weekStart', () => {
  it('начало суток Алматы для утреннего инстанта', () => {
    // 10:30 Алматы 3 июля → 00:00 Алматы 3 июля = 19:00 UTC 2 июля
    const instant = fromAlmaty(new Date(2026, 6, 3, 10, 30));
    expect(almatyDayStart(instant).toISOString()).toBe('2026-07-02T19:00:00.000Z');
  });
  it('addDays сохраняет стеночное время', () => {
    const d = addDays(fromAlmaty(new Date(2026, 6, 3, 22, 30)), 1);
    const w = toAlmaty(d);
    expect([w.getDate(), w.getHours(), w.getMinutes()]).toEqual([4, 22, 30]);
  });
  it('weekStart — понедельник 00:00 Алматы', () => {
    // 3 июля 2026 — пятница → неделя начинается в пн 29 июня
    const ws = weekStart(fromAlmaty(new Date(2026, 6, 3, 15)));
    const w = toAlmaty(ws);
    expect([w.getFullYear(), w.getMonth(), w.getDate(), w.getHours()]).toEqual([2026, 5, 29, 0]);
    expect(w.getDay()).toBe(1); // понедельник
  });
  it('weekStart от понедельника — тот же день', () => {
    const mon = fromAlmaty(new Date(2026, 5, 29, 9));
    expect(weekStart(mon).toISOString()).toBe(fromAlmaty(new Date(2026, 5, 29, 0)).toISOString());
  });
});

describe('toLocalInput / fromLocalInput', () => {
  it('round-trip строки datetime-local', () => {
    expect(toLocalInput(fromLocalInput('2026-07-03T10:00'))).toBe('2026-07-03T10:00');
    expect(toLocalInput(fromLocalInput('2026-12-31T23:59'))).toBe('2026-12-31T23:59');
  });
  it('fromLocalInput трактует строку как стеночное время Алматы', () => {
    expect(fromLocalInput('2026-07-03T10:00').toISOString()).toBe('2026-07-03T05:00:00.000Z');
  });
});
