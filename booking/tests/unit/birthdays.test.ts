import {describe, expect, it} from 'vitest';
import {
  daysUntilBirthday, ageTurning, upcomingBirthdays, birthdaysInMonth,
  toInputValue, parseInputDate, type Today,
} from '@/lib/birthdays';

const dob = (s: string) => new Date(`${s}T00:00:00.000Z`);
const today: Today = {year: 2026, month: 6, day: 2}; // 2 июля 2026

describe('daysUntilBirthday', () => {
  it('сегодня → 0, завтра → 1', () => {
    expect(daysUntilBirthday(dob('1990-07-02'), today)).toBe(0);
    expect(daysUntilBirthday(dob('1990-07-03'), today)).toBe(1);
  });
  it('прошедший в этом году ДР → следующий год', () => {
    expect(daysUntilBirthday(dob('1990-07-01'), today)).toBe(364);
  });
});

describe('ageTurning — согласован с daysUntilBirthday (вкл. 29 февраля)', () => {
  it('обычная дата', () => {
    expect(ageTurning(dob('1990-07-02'), today)).toBe(36); // исполняется сегодня
    expect(ageTurning(dob('1990-07-01'), today)).toBe(37); // следующий ДР — в 2027
  });
  it('29 февраля в невисокосный год = 1 марта, возраст без сдвига', () => {
    const feb29 = dob('2000-02-29');
    const t: Today = {year: 2027, month: 2, day: 1}; // 1 марта 2027
    expect(daysUntilBirthday(feb29, t)).toBe(0);
    expect(ageTurning(feb29, t)).toBe(27);
  });
});

describe('upcomingBirthdays — полуоткрытое окно «7 дней»', () => {
  const mk = (m: number, d: number) => ({dateOfBirth: new Date(Date.UTC(1990, m, d))});
  it('дни 0..6 входят, день 7 — нет', () => {
    const res = upcomingBirthdays([mk(6, 2), mk(6, 8), mk(6, 9)], today, 7);
    expect(res.map((c) => c.daysUntil)).toEqual([0, 6]);
  });
  it('клиенты без даты рождения пропускаются', () => {
    expect(upcomingBirthdays([{dateOfBirth: undefined}], today, 7)).toEqual([]);
  });
});

describe('birthdaysInMonth', () => {
  const mk = (m: number, d: number) => ({dateOfBirth: new Date(Date.UTC(1990, m, d))});
  it('фильтр по месяцу и сортировка по дню', () => {
    const res = birthdaysInMonth([mk(6, 20), mk(5, 1), mk(6, 3)], 6);
    expect(res.map((c) => (c.dateOfBirth as Date).getUTCDate())).toEqual([3, 20]);
  });
});

describe('toInputValue / parseInputDate', () => {
  it('round-trip без сдвига дня', () => {
    expect(toInputValue(parseInputDate('1990-02-28'))).toBe('1990-02-28');
  });
});
