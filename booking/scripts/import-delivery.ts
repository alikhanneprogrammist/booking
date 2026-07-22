// Разовый импорт журнала внутренней доставки из эксель-файла «Еженедельный анализ
// доставки OFFICE» (листы-недели, блок «Свод недельной Внутренней Доставки»)
// в таблицу DeliveryOrder. Одна строка экселя = один день = одна запись журнала
// (если заказов за день несколько — сумма общая, в примечание дописывается
// «заказов за день: N»; подтверждено Алиханом). Блок Яндекс/Wolt не импортируется.
//
// Дата берётся из ИМЕНИ ЛИСТА (dd.mm-dd.mm, год 2026) + колонки «Дни недели»:
// в части листов ячейки «Дата» скопированы со старой недели и врут (25.05, 01.06),
// имя листа + день недели — единственный надёжный источник.
//
// Запуск локально (из booking/, DATABASE_URL из .env):
//   npx tsx scripts/import-delivery.ts "../Ежене"*.xlsx --dry-run   # проверка без записи
//   npx tsx scripts/import-delivery.ts "../Ежене"*.xlsx             # импорт
//
// На проде — внутри контейнера:
//   docker compose run --rm -v "$PWD/../Еженедельный анализ доставки OFFICE 13.07-19.07.xlsx:/data/delivery.xlsx:ro" \
//     app npx tsx scripts/import-delivery.ts /data/delivery.xlsx --dry-run
//
// Идемпотентно: уже импортированные строки (та же дата+сумма+адрес+телефон) пропускаются.

import {PrismaClient} from '@prisma/client';
import * as XLSX from 'xlsx';
import {fromZonedTime} from 'date-fns-tz';
import {TIMEZONE} from '../lib/time';

const prisma = new PrismaClient();

// Файл покрывает только 2026 год; в самих листах год нигде не указан.
const YEAR = 2026;

const WEEKDAYS = [
  'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье',
];

type Wall = {y: number; m: number; d: number};

type Entry = {
  date: Wall;
  amount: number; // 0 — сумма в экселе не указана/не число (бартер и т.п.)
  courierCost: number | null;
  address: string | null;
  phone: string | null;
  promo: string | null;
  note: string | null;
  sheet: string;
};

const wallKey = (w: Wall) =>
  `${w.y}-${String(w.m).padStart(2, '0')}-${String(w.d).padStart(2, '0')}`;

// «Стеночный» полдень Алматы → UTC-инстант (журнал группирует по дню Алматы).
function almatyNoon(w: Wall): Date {
  return fromZonedTime(`${wallKey(w)}T12:00:00`, TIMEZONE);
}

function shiftDays(w: Wall, n: number): Wall {
  const dt = new Date(Date.UTC(w.y, w.m - 1, w.d + n));
  return {y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate()};
}

// Понедельник недели из имени листа «13.07-19.07» / «22.06 - 28.06».
function weekStartFromSheetName(name: string): Wall | null {
  const m = name.match(/(\d{1,2})\.(\d{1,2})/);
  if (!m) return null;
  const w = {y: YEAR, d: Number(m[1]), m: Number(m[2])};
  // Санити: имя листа должно давать понедельник, иначе дни недели съедут.
  const dow = new Date(Date.UTC(w.y, w.m - 1, w.d)).getUTCDay();
  if (dow !== 1) {
    console.log(`  ! «${name}»: ${wallKey(w)} — не понедельник, лист пропущен`);
    return null;
  }
  return w;
}

// Первое число в ячейке с разделителями тысяч («35 900», «23,800»); 0 — не число.
function parseAmount(v: unknown): number {
  if (typeof v === 'number') return Math.round(v);
  const m = String(v ?? '').match(/\d{1,3}(?:[ ,.]\d{3})+|\d+/);
  return m ? Number(m[0].replace(/\D/g, '')) : 0;
}

const cellStr = (r: unknown[], i: number) =>
  String(r?.[i] ?? '').replace(/\s+/g, ' ').trim();

// ─────────────────────────── Парсинг листа ──────────────────────────────────

// Блок «Свод недельной Внутренней Доставки»:
// Дата | Дни недели | Кол-во заказов | Сумма | Затраты на курьера | Примечание | Адреса | Телефон | Акция
function parseSheet(matrix: unknown[][], sheet: string, skipped: string[]): Entry[] {
  const week = weekStartFromSheetName(sheet);
  if (!week) return [];
  const headerIdx = matrix.findIndex((r) => cellStr(r as unknown[], 0).startsWith('Дата'));
  if (headerIdx < 0) return []; // ранние листы — только блок Яндекс/Wolt, свода нет

  const out: Entry[] = [];
  for (const r of matrix.slice(headerIdx + 1) as unknown[][]) {
    const weekdayIdx = WEEKDAYS.indexOf(cellStr(r, 1).toLowerCase());
    if (weekdayIdx < 0) break; // «итого…»/пустая строка — конец блока дней

    const amount = parseAmount(r[3]);
    const count = typeof r[2] === 'number' ? Math.round(r[2]) : parseAmount(r[2]);
    const courier = parseAmount(r[4]);
    const address = cellStr(r, 6) || null;
    const phone = cellStr(r, 7) || null;
    const promo = cellStr(r, 8) || null;
    const noteRaw = cellStr(r, 5) || null;

    // День без заказа: нет ни суммы, ни адреса (бывает только акция или
    // одинокий телефон — остаток скопированных ячеек, в итоги листа не входит).
    if (!amount && !address) {
      if (courier || noteRaw || phone) skipped.push(`${sheet}: ${JSON.stringify(r).slice(0, 120)}`);
      continue;
    }

    // Сумма не распозналась, но заказ был (бартер/не внесли) — импортируем с 0,
    // исходный текст ячейки сохраняем в примечании.
    const amountText = !amount && cellStr(r, 3) ? `сумма в экселе: «${cellStr(r, 3)}»` : null;
    const note =
      [count > 1 ? `заказов за день: ${count}` : null, noteRaw, amountText]
        .filter(Boolean)
        .join('; ') || null;

    out.push({
      date: shiftDays(week, weekdayIdx),
      amount,
      courierCost: courier > 0 ? courier : null,
      address,
      phone,
      promo,
      note,
      sheet,
    });
  }
  return out;
}

// ─────────────────────────── Основной прогон ────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('Использование: npx tsx scripts/import-delivery.ts <файл.xlsx> [--dry-run]');
    process.exit(1);
  }

  const wb = XLSX.readFile(file);
  const skipped: string[] = [];
  const entries: Entry[] = [];
  for (const name of wb.SheetNames) {
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], {header: 1, raw: true});
    const parsed = parseSheet(matrix, name, skipped);
    if (parsed.length === 0) {
      console.log(`→ лист «${name}»: строк доставки нет — пропущен`);
      continue;
    }
    const sum = parsed.reduce((s, e) => s + e.amount, 0);
    const courier = parsed.reduce((s, e) => s + (e.courierCost ?? 0), 0);
    // Сводка по листу — для сверки со строкой «итого по факту» в экселе.
    console.log(
      `→ лист «${name}»: строк ${parsed.length}, сумма ${sum.toLocaleString('ru-RU')} ₸, курьер ${courier.toLocaleString('ru-RU')} ₸`,
    );
    entries.push(...parsed);
  }

  const total = entries.reduce((s, e) => s + e.amount, 0);
  console.log(`\nВсего строк: ${entries.length}, общая сумма: ${total.toLocaleString('ru-RU')} ₸`);
  if (skipped.length) {
    console.log('Пропущенные строки (день без суммы и адреса, но с данными):');
    skipped.forEach((s) => console.log('  ', s));
  }
  const zeroAmount = entries.filter((e) => !e.amount);
  if (zeroAmount.length) {
    console.log('Строки с нулевой суммой (сумма в экселе не распознана — проверить вручную):');
    zeroAmount.forEach((e) => console.log(`   ${wallKey(e.date)} · ${e.address ?? '—'} · ${e.note ?? ''}`));
  }
  if (dryRun) {
    console.log('\n--dry-run: в базу ничего не записано.');
    return;
  }

  let created = 0;
  let existed = 0;
  for (const e of entries) {
    const date = almatyNoon(e.date);
    const dup = await prisma.deliveryOrder.findFirst({
      where: {date, amount: e.amount, address: e.address, phone: e.phone},
      select: {id: true},
    });
    if (dup) {
      existed += 1;
      continue;
    }
    await prisma.deliveryOrder.create({
      data: {
        date,
        amount: e.amount,
        courierCost: e.courierCost,
        address: e.address,
        phone: e.phone,
        promo: e.promo,
        note: e.note,
        manager: null, // ответственный в экселе не указан
      },
    });
    created += 1;
  }
  console.log(`\nГотово: создано записей ${created}, уже были (пропущено) ${existed}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
