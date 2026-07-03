import {normalizePhone} from './phone';

/**
 * Разбор таблицы гостей (клиентов) из Excel/CSV — матрица ячеек от SheetJS,
 * модуль чистый и тестируемый (парная логика: lib/import-users.ts).
 *
 * Колонки: Имя*, Телефон*, Заметка, Теги (через запятую), Дата рождения
 * (ДД.ММ.ГГГГ / ГГГГ-ММ-ДД / датой Excel). Первая строка — заголовки
 * (ru/kk/en); если не распознаны — колонки по порядку.
 */

/** Шаблон файла (кнопка «Скачать шаблон»): заголовки распознаются парсером ниже. */
export const CLIENT_TEMPLATE: Record<'ru' | 'kk', {sheet: string; file: string; rows: string[][]}> = {
  ru: {
    sheet: 'Гости',
    file: 'гости-шаблон.xlsx',
    rows: [
      ['Имя', 'Телефон', 'Заметка', 'Теги', 'Дата рождения'],
      ['Алихан Серіков', '+7 701 123 45 67', 'VIP-гость', 'постоянный, vip', '15.03.1990'],
      ['Дана Ким', '8 701 222 33 44', '', '', ''],
    ],
  },
  kk: {
    sheet: 'Қонақтар',
    file: 'qonaqtar-ulgi.xlsx',
    rows: [
      ['Аты', 'Телефон', 'Ескертпе', 'Тегтер', 'Туған күні'],
      ['Алихан Серіков', '+7 701 123 45 67', 'VIP-қонақ', 'тұрақты, vip', '15.03.1990'],
      ['Дана Ким', '8 701 222 33 44', '', '', ''],
    ],
  },
};

export interface ImportClientRow {
  line: number;
  name: string;
  phone: string; // нормализованный +7…
  note?: string;
  tags?: string[];
  dateOfBirth?: Date; // UTC-полночь (конвенция lib/birthdays)
  error?: string; // emptyName | badPhone | badDate | dupInFile
}

const HEADER_ALIASES: Record<'name' | 'phone' | 'note' | 'tags' | 'birthday', string[]> = {
  name: ['имя', 'фио', 'name', 'аты', 'аты-жөні', 'гость', 'клиент'],
  phone: ['телефон', 'phone', 'тел', 'номер'],
  note: ['заметка', 'примечание', 'комментарий', 'note', 'ескертпе'],
  tags: ['теги', 'тег', 'tags', 'тегтер'],
  birthday: ['дата рождения', 'др', 'день рождения', 'birthday', 'туған күні', 'туған күн'],
};

type ColumnMap = Partial<Record<keyof typeof HEADER_ALIASES, number>>;

const cell = (row: unknown[], idx: number | undefined): string =>
  idx == null ? '' : String(row[idx] ?? '').trim();

function detectHeader(row: unknown[]): ColumnMap | null {
  const map: ColumnMap = {};
  row.forEach((c, i) => {
    const v = String(c ?? '').trim().toLowerCase();
    (Object.keys(HEADER_ALIASES) as (keyof typeof HEADER_ALIASES)[]).forEach((field) => {
      if (map[field] == null && HEADER_ALIASES[field].includes(v)) map[field] = i;
    });
  });
  return map.name != null && map.phone != null ? map : null;
}

/** Дата в UTC-полночь с проверкой реальности (отбрасывает 31.02 и т.п.). */
function utcDate(y: number, m: number, d: number): Date | 'bad' {
  if (y < 1900 || y > 2100) return 'bad';
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
    ? dt
    : 'bad';
}

/** Ячейка даты: серийное число Excel, ГГГГ-ММ-ДД или ДД.ММ.ГГГГ. */
export function parseBirthdayCell(v: unknown): Date | null | 'bad' {
  if (v == null || String(v).trim() === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) {
    // Серийная дата Excel (система 1900): 25569 = 1970-01-01.
    if (v < 61 || v > 80000) return 'bad';
    const d = new Date(Math.round((v - 25569) * 86_400_000));
    return utcDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return utcDate(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (m) return utcDate(+m[3], +m[2], +m[1]);
  return 'bad';
}

export function parseClientRows(matrix: unknown[][]): ImportClientRow[] {
  if (matrix.length === 0) return [];

  const header = detectHeader(matrix[0]);
  const cols: ColumnMap = header ?? {name: 0, phone: 1, note: 2, tags: 3, birthday: 4};
  const dataRows = header ? matrix.slice(1) : matrix;
  const startLine = header ? 2 : 1;

  const seenPhones = new Set<string>();
  const out: ImportClientRow[] = [];

  dataRows.forEach((row, i) => {
    if (row.every((c) => String(c ?? '').trim() === '')) return; // пустые строки — молча

    const line = startLine + i;
    const name = cell(row, cols.name);
    const phone = normalizePhone(cell(row, cols.phone));
    const note = cell(row, cols.note) || undefined;
    const tagsRaw = cell(row, cols.tags);
    const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : undefined;
    const birthday = parseBirthdayCell(cols.birthday == null ? null : row[cols.birthday]);

    const base: ImportClientRow = {line, name, phone, note, tags};

    if (!name) return out.push({...base, error: 'emptyName'});
    if (!/^\+\d{10,15}$/.test(phone)) return out.push({...base, error: 'badPhone'});
    if (birthday === 'bad') return out.push({...base, error: 'badDate'});
    if (seenPhones.has(phone)) return out.push({...base, error: 'dupInFile'});

    seenPhones.add(phone);
    out.push({...base, dateOfBirth: birthday ?? undefined});
  });

  return out;
}
