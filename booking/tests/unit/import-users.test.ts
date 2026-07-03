import {describe, expect, it} from 'vitest';
import {parseUserRows, USER_TEMPLATE} from '@/lib/import-users';

describe('USER_TEMPLATE — скачиваемый шаблон понимается парсером', () => {
  (['ru', 'kk'] as const).forEach((loc) => {
    it(`шаблон ${loc}: все строки-примеры валидны`, () => {
      const rows = parseUserRows(USER_TEMPLATE[loc].rows);
      expect(rows.length).toBe(USER_TEMPLATE[loc].rows.length - 1); // минус заголовок
      expect(rows.every((r) => !r.error)).toBe(true);
      expect(rows[1].role).toBe('ADMIN'); // «Админ»/«Әкімші» распознан
      expect(rows[1].password).toBe('secret99');
    });
  });
});

describe('parseUserRows — заголовки', () => {
  it('распознаёт русские заголовки и маппит колонки', () => {
    const rows = parseUserRows([
      ['Имя', 'Телефон', 'Email', 'Роль', 'Пароль'],
      ['Айдана', '8 701 111 22 33', 'a@x.kz', 'Менеджер', ''],
      ['Бекзат', '+77012223344', '', 'Админ', 'secret99'],
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({line: 2, name: 'Айдана', phone: '+77011112233', role: 'MANAGER'});
    expect(rows[0].error).toBeUndefined();
    expect(rows[1]).toMatchObject({name: 'Бекзат', role: 'ADMIN', password: 'secret99'});
  });

  it('без заголовков читает колонки по порядку', () => {
    const rows = parseUserRows([['Гульнара', '7011234567']]);
    expect(rows[0]).toMatchObject({line: 1, name: 'Гульнара', phone: '+77011234567', role: 'MANAGER'});
  });

  it('телефон числом (Excel) не теряет формат', () => {
    const rows = parseUserRows([[
      'Дана', 87019998877,
    ]]);
    expect(rows[0].phone).toBe('+77019998877');
    expect(rows[0].error).toBeUndefined();
  });
});

describe('parseUserRows — валидация', () => {
  it('пустое имя, кривой телефон, неизвестная роль, короткий пароль', () => {
    const rows = parseUserRows([
      ['', '+77011234567'],
      ['Имя', 'абракадабра'],
      ['Имя', '+77011234568', '', 'директор'],
      ['Имя', '+77011234569', '', '', '123'],
    ]);
    expect(rows.map((r) => r.error)).toEqual(['emptyName', 'badPhone', 'badRole', 'shortPassword']);
  });

  it('дубль телефона внутри файла помечается', () => {
    const rows = parseUserRows([
      ['А', '+77011234567'],
      ['Б', '8 701 123 45 67'], // тот же номер в другом формате
    ]);
    expect(rows[0].error).toBeUndefined();
    expect(rows[1].error).toBe('dupInFile');
  });

  it('полностью пустые строки пропускаются молча', () => {
    const rows = parseUserRows([
      ['Имя', 'Телефон'],
      ['', '', ''],
      ['А', '+77011234567'],
      [],
    ]);
    expect(rows).toHaveLength(1);
  });

  it('пустая матрица → пусто', () => {
    expect(parseUserRows([])).toEqual([]);
  });
});
