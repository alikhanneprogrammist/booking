import {describe, expect, it} from 'vitest';
import {parseClientRows, parseBirthdayCell} from '@/lib/import-clients';

describe('parseBirthdayCell', () => {
  it('пусто → null', () => {
    expect(parseBirthdayCell('')).toBeNull();
    expect(parseBirthdayCell(null)).toBeNull();
  });
  it('ДД.ММ.ГГГГ и ГГГГ-ММ-ДД → UTC-полночь', () => {
    expect((parseBirthdayCell('15.03.1990') as Date).toISOString()).toBe('1990-03-15T00:00:00.000Z');
    expect((parseBirthdayCell('1990-03-15') as Date).toISOString()).toBe('1990-03-15T00:00:00.000Z');
    expect((parseBirthdayCell('3.7.1988') as Date).toISOString()).toBe('1988-07-03T00:00:00.000Z');
  });
  it('серийная дата Excel: 32947 = 15.03.1990', () => {
    expect((parseBirthdayCell(32947) as Date).toISOString()).toBe('1990-03-15T00:00:00.000Z');
  });
  it('несуществующая дата и мусор → bad', () => {
    expect(parseBirthdayCell('31.02.1990')).toBe('bad');
    expect(parseBirthdayCell('вчера')).toBe('bad');
    expect(parseBirthdayCell('15.03.1899')).toBe('bad');
  });
});

describe('parseClientRows', () => {
  it('заголовки + теги + дата', () => {
    const rows = parseClientRows([
      ['Имя', 'Телефон', 'Заметка', 'Теги', 'Дата рождения'],
      ['Алихан', '8 701 123 45 67', 'VIP-гость', 'постоянный, vip', '15.03.1990'],
      ['Дана', '+77012223344', '', '', ''],
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      line: 2,
      name: 'Алихан',
      phone: '+77011234567',
      note: 'VIP-гость',
      tags: ['постоянный', 'vip'],
    });
    expect(rows[0].dateOfBirth?.toISOString()).toBe('1990-03-15T00:00:00.000Z');
    expect(rows[1].error).toBeUndefined();
    expect(rows[1].dateOfBirth).toBeUndefined();
  });

  it('без заголовков — колонки по порядку', () => {
    const rows = parseClientRows([['Гость', '7011234567']]);
    expect(rows[0]).toMatchObject({line: 1, name: 'Гость', phone: '+77011234567'});
  });

  it('валидация: имя, телефон, дата, дубль в файле', () => {
    const rows = parseClientRows([
      ['', '+77011234567'],
      ['А', 'не-телефон'],
      ['Б', '+77011234568', '', '', '99.99.2020'],
      ['В', '+77011234569'],
      ['Г', '8 701 123 45 69'], // дубль В в другом формате
    ]);
    expect(rows.map((r) => r.error)).toEqual(['emptyName', 'badPhone', 'badDate', undefined, 'dupInFile']);
  });
});
