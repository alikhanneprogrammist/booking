// Разовый импорт журнала внутренней доставки из эксель-файла «Еженедельный анализ
// доставки OFFICE» (листы-недели, блок «Свод недельной Внутренней Доставки»)
// в таблицу DeliveryOrder. Если в дне несколько заказов (адреса через запятую/
// слэш) — каждый заказ отдельной записью: адрес и телефон свои, сумма дня
// делится поровну (в экселе сумм по заказам нет; помечено в примечании).
// Блок Яндекс/Wolt не импортируется.
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
// Идемпотентно: уже импортированные строки (та же дата+сумма+адрес+телефон)
// пропускаются. Флаг --replace сначала удаляет прежний импорт (записи без
// ответственного) в диапазоне дат файла — для перезаливки после смены правил.

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

// Лог разбивок мульти-дней на отдельные заказы — показывается для сверки.
const SPLITS: string[] = [];

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

    // Без суммы не импортируем вообще (решение Алихана): пустые дни, дни
    // только с акцией/телефоном и заказы с незаполненной суммой — пропуск с логом.
    if (!amount) {
      if (address || phone || courier || noteRaw) {
        skipped.push(`${sheet}: ${JSON.stringify(r).slice(0, 140)}`);
      }
      continue;
    }

    const date = shiftDays(week, weekdayIdx);
    const courierCost = courier > 0 ? courier : null;

    // Несколько заказов в одной строке дня → отдельная запись на каждый адрес.
    // «Количество заказов = 1» в экселе — не разбиваем (запятая внутри адреса).
    // Разбиваем НЕсхлопнутую строку: 2+ пробела подряд — тоже разделитель.
    const addrParts = count === 1 ? [] : splitAddresses(String(r?.[6] ?? ''));
    if (addrParts.length <= 1) {
      const note =
        [count > 1 ? `заказов за день: ${count}` : null, noteRaw]
          .filter(Boolean)
          .join('; ') || null;
      out.push({date, amount, courierCost, address, phone, promo, note, sheet});
      continue;
    }

    const phones = splitPhones(String(r?.[7] ?? ''));
    const k = addrParts.length;
    SPLITS.push(`${wallKey(date)}: ${k} строк ← «${address}»`);
    // Суммы по заказам в экселе нет — делим поровну, остаток от округления первому.
    const amountBase = Math.floor(amount / k);
    const courierBase = courierCost !== null ? Math.floor(courierCost / k) : null;
    for (let i = 0; i < k; i++) {
      const splitNote = `${i + 1}/${k} заказов дня; сумма дня ${amount.toLocaleString('ru-RU')} ₸ разделена поровну`;
      const mismatch = count > 1 && count !== k ? `в экселе заказов: ${count}` : null;
      out.push({
        date,
        amount: i === 0 ? amount - amountBase * (k - 1) : amountBase,
        courierCost:
          courierBase === null ? null : i === 0 ? courierCost! - courierBase * (k - 1) : courierBase,
        address: addrParts[i],
        phone: phones[i] ?? null,
        promo,
        // Примечание дня и мусорную сумму не дублируем — только на первой записи.
        note:
          [i === 0 ? noteRaw : null, splitNote, mismatch]
            .filter(Boolean)
            .join('; ') || null,
        sheet,
      });
    }
  }
  return out;
}

/**
 * Разбивка ячейки «Адреса» на отдельные адреса. Разделители: запятая/точка
 * с запятой; слэш или бэкслэш ПЕРЕД буквой (перед цифрой — номер дома,
 * «Достык 5/1»); 2+ пробела подряд («Казбек би 3/2    Туран 55/6»).
 * «кв…» и части с цифры приклеиваются к предыдущей («Аль-Фараби 10, кв.58»,
 * «ул Женис 31,1 подьезд 8 кв» — один адрес: улицы начинаются с буквы).
 */
function splitAddresses(s: string | null): string[] {
  if (!s) return [];
  const parts = s
    .split(/\s*[,;]\s*/)
    .flatMap((p) => p.split(/\s*[/\\]+\s*(?=[^\s\d/\\])/))
    .flatMap((p) => p.split(/\s{2,}/))
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    if ((/^кв\.?\s*\d/i.test(p) || /^\d/.test(p)) && out.length) out[out.length - 1] += `, ${p}`;
    else out.push(p);
  }
  return out;
}

/** Разбивка ячейки «Телефон»; части без 6+ цифр (текст, обрывки) отбрасываются. */
function splitPhones(s: string | null): string[] {
  if (!s) return [];
  return s
    .split(/\s*[,;/\\]+\s*|\s{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => (p.match(/\d/g) ?? []).length >= 6);
}

// ─────────────────────────── Основной прогон ────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const replace = args.includes('--replace');
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('Использование: npx tsx scripts/import-delivery.ts <файл.xlsx> [--dry-run] [--replace]');
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
  if (SPLITS.length) {
    console.log('Дни с несколькими заказами, разбитые на отдельные строки:');
    SPLITS.forEach((s) => console.log('  ', s));
  }
  if (skipped.length) {
    console.log('Пропущено (в экселе нет суммы — не импортируем):');
    skipped.forEach((s) => console.log('  ', s));
  }
  if (dryRun) {
    console.log('\n--dry-run: в базу ничего не записано.');
    return;
  }

  // --replace: убрать прежний импорт (manager IS NULL — ручные записи менеджеров
  // не трогаем) в диапазоне дат файла, затем залить заново с разбивкой.
  if (replace && entries.length) {
    const times = entries.map((e) => almatyNoon(e.date).getTime());
    const del = await prisma.deliveryOrder.deleteMany({
      where: {manager: null, date: {gte: new Date(Math.min(...times)), lte: new Date(Math.max(...times))}},
    });
    console.log(`--replace: удалено прежних импортированных записей: ${del.count}`);
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
