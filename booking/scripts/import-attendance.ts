// Разовый импорт НЕДЕЛЬНЫХ ИТОГОВ посещаемости из эксель-файла «Недельный
// Анализ Посещаемости» (листы-недели с дек 2023) в AttendanceArchive:
// weekStart (понедельник) × источник → кол-во заездов (+сумма, где была).
// По дням не импортируем — только строку «ИТОГО» каждого листа.
//
// Год листа в файле не указан — определяется по дню недели первой строки
// (например, «20 июля» = понедельник только в 2026 из диапазона 2023–2026).
//
// Запуск (из booking/):
//   npx tsx scripts/import-attendance.ts ../Недельный*.xlsx --dry-run
//   npx tsx scripts/import-attendance.ts ../Недельный*.xlsx
//
// На проде — внутри контейнера:
//   docker compose run --rm -v "$(readlink -f ../Недельный*.xlsx):/data/att.xlsx:ro" \
//     app npx tsx scripts/import-attendance.ts /data/att.xlsx
//
// Идемпотентно: upsert по (weekStart, source).

import {PrismaClient} from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

const YEARS = [2023, 2024, 2025, 2026];

const MONTHS: Record<string, number> = {
  январ: 1, феврал: 2, март: 3, апрел: 4, ма: 5, июн: 6,
  июл: 7, август: 8, сентябр: 9, октябр: 10, ноябр: 11, декабр: 12,
};

const WEEKDAYS = [
  'воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота',
];

// Подпись колонки экселя → канонический ключ BookingSource; null — не источник.
const SOURCE_MAP: Array<[RegExp, string]> = [
  [/2\s*g[i1]s|2\s*гис/i, 'TWO_GIS'],
  [/инстагр/i, 'INSTAGRAM'],
  [/рекоменд/i, 'REFERRAL'],
  [/постоянн/i, 'REGULAR'],
  [/агент/i, 'AGENT'],
  [/был\s*ранее/i, 'RETURNING'],
  [/мукбанг/i, 'MUKBANG'],
  [/гугл|google/i, 'GOOGLE_SITE'],
  [/наружн/i, 'OUTDOOR_AD'],
  [/блогер/i, 'BLOGGERS'],
  [/be\s*2\s*be|b\s*2\s*b/i, 'B2B'],
  [/яндекс/i, 'YANDEX'],
  [/bi\s*loyal|loyal/i, 'BI_KMG_QAZGAZ'],
];

const SKIP_COLS = /^(ср\.?\s*чек|итого|дата|дни\s*недели|сумма|кол)/i;

function canonSource(label: string): string | null {
  const s = label.trim();
  if (!s || SKIP_COLS.test(s)) return null;
  for (const [re, key] of SOURCE_MAP) if (re.test(s)) return key;
  // Неизвестная подпись («Неизвестно» и т.п.) — как есть, с ровным регистром.
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

const cellStr = (r: unknown[], i: number) => String(r?.[i] ?? '').replace(/\s+/g, ' ').trim();

function parseNum(v: unknown): number {
  if (typeof v === 'number') return Math.round(v);
  const m = String(v ?? '').match(/\d{1,3}(?:[ ,.]\d{3})+|\d+/);
  return m ? Number(m[0].replace(/\D/g, '')) : 0;
}

/**
 * Неделя из ИМЕНИ листа (приоритетный источник: в строках дат бывают копии
 * прошлых недель). Форматы: «20.07-26.07», «6.05.24-12.05.24», «08.01.2024»,
 * «25-31.12.23». Без года — подбираем год из 2023–2026, где дата = понедельник.
 */
function resolveFromName(name: string): Date | null {
  const s = name.trim();
  let d = 0;
  let m = 0;
  let y: number | null = null;
  let match = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/); // D.M.YY[YY]…
  if (match) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = s.match(/^(\d{1,2})-\d{1,2}\.(\d{1,2})\.(\d{2,4})/))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])]; // D-D.M.YY
  } else if ((match = s.match(/^(\d{1,2})\.(\d{1,2})/))) {
    [d, m] = [Number(match[1]), Number(match[2])]; // D.M-D.M — год подберём
  } else {
    return null;
  }
  if (y !== null) {
    if (y < 100) y += 2000;
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCDate() === d ? dt : null;
  }
  const candidates = YEARS.filter((yy) => {
    const dt = new Date(Date.UTC(yy, m - 1, d));
    return dt.getUTCDate() === d && dt.getUTCDay() === 1; // понедельник
  });
  return candidates.length === 1 ? new Date(Date.UTC(candidates[0], m - 1, d)) : null;
}

// «20 июля» (+ день недели «Понедельник») → дата с годом, подобранным по дню недели.
function resolveDate(dayCell: unknown, weekdayCell: string): Date | null {
  // Excel-serial (эпоха 1899-12-30) — год уже внутри.
  if (typeof dayCell === 'number' && dayCell > 40000 && dayCell < 60000) {
    return new Date(Date.UTC(1899, 11, 30) + Math.round(dayCell) * 86_400_000);
  }
  const m = String(dayCell ?? '').trim().toLowerCase().match(/^(\d{1,2})\s+([а-яё]+)/);
  if (!m) return null;
  const day = Number(m[1]);
  const monthKey = Object.keys(MONTHS).find((k) => m[2].startsWith(k));
  if (!monthKey) return null;
  const month = MONTHS[monthKey];
  const wd = WEEKDAYS.indexOf(weekdayCell.trim().toLowerCase());
  const candidates = YEARS.filter((y) => {
    const d = new Date(Date.UTC(y, month - 1, day));
    return d.getUTCDate() === day && (wd < 0 || d.getUTCDay() === wd);
  });
  if (candidates.length !== 1) return null; // неоднозначно/не найден — пропуск с логом
  return new Date(Date.UTC(candidates[0], month - 1, day));
}

/** Понедельник недели указанной UTC-даты. */
function mondayOf(d: Date): Date {
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - back * 86_400_000);
}

type WeekRow = {weekStart: Date; source: string; count: number; amount: number | null};

function parseSheet(matrix: unknown[][], sheet: string, skipped: string[]): WeekRow[] {
  const headerIdx = matrix.findIndex((r) => cellStr(r as unknown[], 0).toLowerCase() === 'дата');
  if (headerIdx < 0) {
    skipped.push(`${sheet}: нет заголовка «Дата»`);
    return [];
  }
  const header = matrix[headerIdx] as unknown[];
  const groupRow = (matrix[headerIdx - 1] ?? []) as unknown[]; // «2gis | Инстаграмм | Гугл» над парами сумма/кол

  // Карта колонок: индекс → {source, kind: 'count'|'amount'}
  const cols: Array<{i: number; source: string; kind: 'count' | 'amount'}> = [];
  for (let i = 2; i < header.length; i++) {
    const h = cellStr(header, i);
    if (!h) continue;
    if (/^кол/i.test(h) || /^сумма/i.test(h)) {
      // Пара из «нового» формата: подпись группы — ближайшая слева в строке выше.
      let label = '';
      for (let j = i; j >= 0 && !label; j--) label = cellStr(groupRow, j);
      const source = canonSource(label);
      if (source) cols.push({i, source, kind: /^кол/i.test(h) ? 'count' : 'amount'});
    } else {
      const source = canonSource(h);
      if (source) cols.push({i, source, kind: 'count'});
    }
  }
  if (!cols.length) {
    skipped.push(`${sheet}: не распознаны колонки источников`);
    return [];
  }

  // Неделя: сначала из имени листа, при неудаче — из первой строки дня.
  const firstDay = matrix[headerIdx + 1] as unknown[];
  const date = resolveFromName(sheet) ?? resolveDate(firstDay?.[0], cellStr(firstDay, 1));
  if (!date) {
    skipped.push(`${sheet}: не определена дата недели (${JSON.stringify(firstDay?.[0])})`);
    return [];
  }
  const weekStart = mondayOf(date);

  // Строка «ИТОГО» (до строки «Прошлая неделя»).
  const totalRow = matrix
    .slice(headerIdx + 1, headerIdx + 12)
    .find((r) => /^итого/i.test(cellStr(r as unknown[], 0))) as unknown[] | undefined;
  if (!totalRow) {
    skipped.push(`${sheet}: нет строки ИТОГО`);
    return [];
  }

  const agg = new Map<string, {count: number; amount: number | null}>();
  for (const c of cols) {
    const v = parseNum(totalRow[c.i]);
    if (!v) continue;
    const cur = agg.get(c.source) ?? {count: 0, amount: null};
    if (c.kind === 'count') cur.count += v;
    else cur.amount = (cur.amount ?? 0) + v;
    agg.set(c.source, cur);
  }
  return Array.from(agg.entries())
    .filter(([, v]) => v.count > 0)
    .map(([source, v]) => ({weekStart, source, count: v.count, amount: v.amount}));
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('Использование: npx tsx scripts/import-attendance.ts <файл.xlsx> [--dry-run]');
    process.exit(1);
  }

  const wb = XLSX.readFile(file);
  const skipped: string[] = [];
  const all: WeekRow[] = [];
  for (const name of wb.SheetNames) {
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], {header: 1, raw: true});
    const rows = parseSheet(matrix, name, skipped);
    if (rows.length) {
      const wk = rows[0].weekStart.toISOString().slice(0, 10);
      const total = rows.reduce((s, r) => s + r.count, 0);
      console.log(`→ «${name}» → неделя ${wk}: источников ${rows.length}, заездов ${total}`);
      all.push(...rows);
    }
  }

  // Дубли (неделя, источник) от «нахлёстных» листов — суммируем с предупреждением.
  const merged = new Map<string, WeekRow>();
  for (const r of all) {
    const key = `${r.weekStart.toISOString().slice(0, 10)}|${r.source}`;
    const cur = merged.get(key);
    if (cur) {
      console.log(`  ! дубль ${key}: ${cur.count}+${r.count} — суммирую`);
      cur.count += r.count;
      if (r.amount !== null) cur.amount = (cur.amount ?? 0) + r.amount;
    } else {
      merged.set(key, {...r});
    }
  }
  const rows = Array.from(merged.values());

  const weeks = new Set(rows.map((r) => r.weekStart.toISOString().slice(0, 10)));
  console.log(`\nНедель: ${weeks.size}, строк архива: ${rows.length}, всего заездов: ${rows.reduce((s, r) => s + r.count, 0)}`);
  if (skipped.length) {
    console.log('Пропущенные листы:');
    skipped.forEach((s) => console.log('  ', s));
  }
  if (dryRun) {
    console.log('\n--dry-run: в базу ничего не записано.');
    return;
  }

  let n = 0;
  for (const r of rows) {
    await prisma.attendanceArchive.upsert({
      where: {weekStart_source: {weekStart: r.weekStart, source: r.source}},
      update: {count: r.count, amount: r.amount},
      create: r,
    });
    n += 1;
  }
  console.log(`\nГотово: записано (upsert) ${n} строк архива.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
