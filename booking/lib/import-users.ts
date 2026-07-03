import {normalizePhone} from './phone';
import type {Role} from './enums';

/**
 * Разбор таблицы сотрудников из Excel/CSV (клиент парсит файл через SheetJS
 * в матрицу ячеек, сюда приходит уже она — модуль чистый и тестируемый).
 *
 * Колонки: Имя*, Телефон*, Email, Роль (Админ/Менеджер), Пароль (пусто →
 * сервер сгенерирует временный). Первая строка — заголовки (ru/kk/en);
 * если заголовки не распознаны, колонки читаются по порядку.
 */

/** Шаблон файла (кнопка «Скачать шаблон»): заголовки распознаются парсером ниже. */
export const USER_TEMPLATE: Record<'ru' | 'kk', {sheet: string; file: string; rows: string[][]}> = {
  ru: {
    sheet: 'Сотрудники',
    file: 'сотрудники-шаблон.xlsx',
    rows: [
      ['Имя', 'Телефон', 'Email', 'Роль', 'Пароль'],
      ['Айдана (смена 1)', '+7 701 111 22 33', 'aidana@office2020.kz', 'Менеджер', ''],
      ['Бекзат', '8 701 222 33 44', '', 'Админ', 'secret99'],
    ],
  },
  kk: {
    sheet: 'Қызметкерлер',
    file: 'qyzmetkerler-ulgi.xlsx',
    rows: [
      ['Аты', 'Телефон', 'Email', 'Рөлі', 'Құпиясөз'],
      ['Айдана (1-ауысым)', '+7 701 111 22 33', 'aidana@office2020.kz', 'Менеджер', ''],
      ['Бекзат', '8 701 222 33 44', '', 'Әкімші', 'secret99'],
    ],
  },
};

export interface ImportUserRow {
  line: number; // номер строки в файле (для сообщений)
  name: string;
  phone: string; // нормализованный +7…
  email?: string;
  role: Role;
  password?: string;
  error?: string; // код ошибки: emptyName | badPhone | badRole | shortPassword | dupInFile
}

const HEADER_ALIASES: Record<'name' | 'phone' | 'email' | 'role' | 'password', string[]> = {
  name: ['имя', 'фио', 'name', 'аты', 'аты-жөні', 'сотрудник'],
  phone: ['телефон', 'phone', 'тел', 'номер'],
  email: ['email', 'e-mail', 'почта', 'пошта'],
  role: ['роль', 'role', 'рөлі', 'рөл'],
  password: ['пароль', 'password', 'құпиясөз'],
};

const ROLE_ALIASES: Record<string, Role> = {
  'admin': 'ADMIN', 'админ': 'ADMIN', 'администратор': 'ADMIN', 'әкімші': 'ADMIN',
  'manager': 'MANAGER', 'менеджер': 'MANAGER',
};

const MIN_PASSWORD = 6;

type ColumnMap = Partial<Record<keyof typeof HEADER_ALIASES, number>>;

const cell = (row: unknown[], idx: number | undefined): string =>
  idx == null ? '' : String(row[idx] ?? '').trim();

/** Распознать строку заголовков; null — заголовков нет (колонки по порядку). */
function detectHeader(row: unknown[]): ColumnMap | null {
  const map: ColumnMap = {};
  row.forEach((c, i) => {
    const v = String(c ?? '').trim().toLowerCase();
    (Object.keys(HEADER_ALIASES) as (keyof typeof HEADER_ALIASES)[]).forEach((field) => {
      if (map[field] == null && HEADER_ALIASES[field].includes(v)) map[field] = i;
    });
  });
  // заголовок засчитываем, только если нашли оба обязательных поля
  return map.name != null && map.phone != null ? map : null;
}

export function parseUserRows(matrix: unknown[][]): ImportUserRow[] {
  if (matrix.length === 0) return [];

  const header = detectHeader(matrix[0]);
  const cols: ColumnMap = header ?? {name: 0, phone: 1, email: 2, role: 3, password: 4};
  const dataRows = header ? matrix.slice(1) : matrix;
  const startLine = header ? 2 : 1;

  const seenPhones = new Set<string>();
  const out: ImportUserRow[] = [];

  dataRows.forEach((row, i) => {
    // полностью пустые строки пропускаем молча
    if (row.every((c) => String(c ?? '').trim() === '')) return;

    const line = startLine + i;
    const name = cell(row, cols.name);
    const phone = normalizePhone(cell(row, cols.phone));
    const email = cell(row, cols.email) || undefined;
    const roleRaw = cell(row, cols.role).toLowerCase();
    const password = cell(row, cols.password) || undefined;

    const base: ImportUserRow = {line, name, phone, email, role: 'MANAGER', password};

    if (!name) return out.push({...base, error: 'emptyName'});
    // '+' + минимум 10 цифр — иначе это не телефон
    if (!/^\+\d{10,15}$/.test(phone)) return out.push({...base, error: 'badPhone'});
    if (roleRaw && !(roleRaw in ROLE_ALIASES)) return out.push({...base, error: 'badRole'});
    if (password && password.length < MIN_PASSWORD) return out.push({...base, error: 'shortPassword'});
    if (seenPhones.has(phone)) return out.push({...base, error: 'dupInFile'});

    seenPhones.add(phone);
    out.push({...base, role: roleRaw ? ROLE_ALIASES[roleRaw] : 'MANAGER'});
  });

  return out;
}
