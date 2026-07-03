import {describe, expect, it} from 'vitest';
import {toAlmaty, fromAlmaty, isWeekend, durationHours, intervalsOverlap} from '@/lib/time';

// Казахстан с 2024 живёт в едином UTC+5 без перевода часов —
// абсолютные инстанты в ассертах безопасны.

describe('fromAlmaty / toAlmaty', () => {
  it('стеночное 10:00 Алматы = 05:00 UTC', () => {
    expect(fromAlmaty(new Date(2026, 6, 3, 10, 0)).toISOString()).toBe('2026-07-03T05:00:00.000Z');
  });

  it('round-trip сохраняет стеночные компоненты', () => {
    const wall = new Date(2026, 11, 31, 23, 30);
    const back = toAlmaty(fromAlmaty(wall));
    expect([back.getFullYear(), back.getMonth(), back.getDate(), back.getHours(), back.getMinutes()])
      .toEqual([2026, 11, 31, 23, 30]);
  });
});

describe('isWeekend (выходные = пт/сб, ТЗ §4.9)', () => {
  const at = (y: number, m: number, d: number, h = 12) => fromAlmaty(new Date(y, m, d, h));
  it('пятница и суббота — выходные', () => {
    expect(isWeekend(at(2026, 6, 3))).toBe(true); // пт
    expect(isWeekend(at(2026, 6, 4))).toBe(true); // сб
  });
  it('воскресенье и среда — будни', () => {
    expect(isWeekend(at(2026, 6, 5))).toBe(false); // вс
    expect(isWeekend(at(2026, 6, 1))).toBe(false); // ср
  });
  it('граница суток: четверг 23:59 — будни, пятница 00:00 — выходной', () => {
    expect(isWeekend(at(2026, 6, 2, 23))).toBe(false);
    expect(isWeekend(at(2026, 6, 3, 0))).toBe(true);
  });
});

describe('durationHours', () => {
  it('целые и дробные часы', () => {
    const s = new Date('2026-07-03T05:00:00Z');
    expect(durationHours(s, new Date('2026-07-03T08:00:00Z'))).toBe(3);
    expect(durationHours(s, new Date('2026-07-03T05:30:00Z'))).toBe(0.5);
  });
});

describe('intervalsOverlap — полуоткрытые [start, end)', () => {
  const d = (h: number) => new Date(Date.UTC(2026, 6, 3, h));
  it('касание концов НЕ пересечение', () => {
    expect(intervalsOverlap(d(10), d(12), d(12), d(14))).toBe(false);
  });
  it('перекрытие на минуту — пересечение', () => {
    expect(intervalsOverlap(d(10), d(13), d(12), d(14))).toBe(true);
  });
  it('вложенный интервал — пересечение', () => {
    expect(intervalsOverlap(d(10), d(20), d(12), d(14))).toBe(true);
  });
});
