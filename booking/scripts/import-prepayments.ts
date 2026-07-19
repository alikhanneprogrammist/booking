// Разовый импорт исторических предоплат из эксель-журнала бухгалтерии (ПРЕДОПЛАТЫ.xlsx)
// в ОТДЕЛЬНУЮ таблицу PrepaymentArchive: чистый текст без связей с Client/User/Resource.
// Архив виден только во вкладке «Предоплаты»; в аналитику, список клиентов и календарь
// не попадает. Новые предоплаты вносятся только вручную — через диалог брони.
//
// Запуск локально (из booking/, DATABASE_URL из .env):
//   npx tsx scripts/import-prepayments.ts "../ПРЕДОПЛАТЫ.xlsx" --dry-run   # проверка без записи
//   npx tsx scripts/import-prepayments.ts "../ПРЕДОПЛАТЫ.xlsx"             # импорт
//
// На проде — внутри контейнера (эксель лежит уровнем выше booking/):
//   docker compose run --rm -v "$PWD/../ПРЕДОПЛАТЫ.xlsx:/data/prepayments.xlsx:ro" \
//     app npx tsx scripts/import-prepayments.ts /data/prepayments.xlsx --dry-run
//
// Идемпотентно: уже импортированные строки (тот же гость+сумма+даты) пропускаются.

import {PrismaClient, PaymentMethod} from '@prisma/client';
import * as XLSX from 'xlsx';
import {fromZonedTime} from 'date-fns-tz';
import {TIMEZONE} from '../lib/time';

const prisma = new PrismaClient();

const PAYMENT_MAP: Array<[RegExp, PaymentMethod]> = [
  [/kaspi|пэй|пей/i, 'KASPI'],
  [/нал/i, 'CASH'],
  [/банк|перевод/i, 'BANK'],
];

// ─────────────────────────── Парсинг ────────────────────────────────────────

type Wall = {y: number; m: number; d: number};

type Entry = {
  amount: number;
  typeRaw: string;
  guest: string;
  vipRaw: string; // текст «VIP №»/«Списание» из экселя — сохраняем как есть
  paid: Wall;
  visit: Wall;
  note: string;
  manager: string;
  sheet: string;
};

// Serial-дата Excel (эпоха 1899-12-30, «стеночная» дата без таймзоны).
function fromSerial(n: number): Wall {
  const ms = Date.UTC(1899, 11, 30) + Math.round(n) * 86_400_000;
  const dt = new Date(ms);
  return {y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate()};
}

// Отсекаем мусорные значения («перенос на откр дату», месяц 13 и т.п.).
function validWall(w: Wall): Wall | null {
  const ok = w.y >= 2020 && w.y <= 2030 && w.m >= 1 && w.m <= 12 && w.d >= 1 && w.d <= 31;
  return ok ? w : null;
}

function parseWall(v: unknown): Wall | null {
  if (typeof v === 'number' && v > 20000 && v < 60000) return validWall(fromSerial(v));
  const s = String(v ?? '').trim();
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); // m/d/yy (старые листы)
  if (us) {
    const y = Number(us[3]) < 100 ? 2000 + Number(us[3]) : Number(us[3]);
    return validWall({y, m: Number(us[1]), d: Number(us[2])});
  }
  const ru = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/); // d.m.yyyy на всякий
  if (ru) {
    const y = Number(ru[3]) < 100 ? 2000 + Number(ru[3]) : Number(ru[3]);
    return validWall({y, m: Number(ru[2]), d: Number(ru[1])});
  }
  return null;
}

// Берём ПЕРВОЕ число в ячейке (с разделителями тысяч «10 000»/«10,000») —
// в грязных строках к сумме бывает приписан ещё и текст/дата.
function parseAmount(v: unknown): number {
  if (typeof v === 'number') return Math.round(v);
  const m = String(v ?? '').match(/\d{1,3}(?:[ ,.]\d{3})+|\d+/);
  return m ? Number(m[0].replace(/\D/g, '')) : 0;
}

const wallKey = (w: Wall) =>
  `${w.y}-${String(w.m).padStart(2, '0')}-${String(w.d).padStart(2, '0')}`;

// «Стеночное» время Алматы → UTC-инстант для хранения.
function almaty(w: Wall, hh: number): Date {
  return fromZonedTime(`${wallKey(w)}T${String(hh).padStart(2, '0')}:00:00`, TIMEZONE);
}

type Matrix = unknown[][];

function sheetMatrix(wb: XLSX.WorkBook, name: string): Matrix {
  return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], {header: 1, raw: true});
}

const cell = (r: unknown[], i: number) => String(r?.[i] ?? '').trim();

// Новые листы «по MM.YYYY»: Сумма | Тип | Гость | VIP № | Дата оплаты | Дата посещения | Прим. | Отв.
function parseNewSheet(matrix: Matrix, sheet: string, skipped: string[]): Entry[] {
  const out: Entry[] = [];
  for (const r of matrix) {
    if (!r || r.length === 0 || cell(r, 0) === 'Сумма п/о') continue; // заголовки (и повторные)
    const amount = parseAmount(r[0]);
    const paid = parseWall(r[4]);
    if (!amount || !paid) {
      if (r.some((c) => String(c ?? '').trim() !== '')) {
        skipped.push(`${sheet}: ${JSON.stringify(r).slice(0, 120)}`);
      }
      continue;
    }
    out.push({
      amount,
      typeRaw: cell(r, 1),
      guest: cell(r, 2) || '—',
      vipRaw: cell(r, 3),
      paid,
      visit: parseWall(r[5]) ?? paid,
      note: cell(r, 6),
      manager: cell(r, 7),
      sheet,
    });
  }
  return out;
}

// Старые листы «по YYYY»: От кого | Дата п/о | Сумма | Дата мероприятия | Списание | Назначение | Кассир
function parseOldSheet(matrix: Matrix, sheet: string, skipped: string[]): Entry[] {
  const out: Entry[] = [];
  const headerIdx = matrix.findIndex((r) => cell(r, 0).startsWith('От кого'));
  for (const r of matrix.slice(headerIdx + 1)) {
    if (!r || r.length === 0) continue;
    const amount = parseAmount(r[2]);
    const paid = parseWall(r[1]);
    if (!amount || !paid || !cell(r, 0)) {
      if (r.some((c) => String(c ?? '').trim() !== '')) {
        skipped.push(`${sheet}: ${JSON.stringify(r).slice(0, 120)}`);
      }
      continue;
    }
    const spis = cell(r, 4);
    out.push({
      amount,
      typeRaw: cell(r, 5),
      guest: cell(r, 0),
      vipRaw: spis, // зал иногда указан в «Списании» («Пз 6 вип», «Банкетный зал бронь»)
      paid,
      visit: parseWall(r[3]) ?? paid,
      note: spis,
      manager: cell(r, 6),
      sheet,
    });
  }
  return out;
}

function mapPayment(typeRaw: string): PaymentMethod | null {
  for (const [re, method] of PAYMENT_MAP) if (re.test(typeRaw)) return method;
  return null;
}

// ─────────────────────────── Основной прогон ────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('Использование: npx tsx scripts/import-prepayments.ts <файл.xlsx> [--dry-run]');
    process.exit(1);
  }

  const wb = XLSX.readFile(file);
  const skipped: string[] = [];
  const entries: Entry[] = [];
  for (const name of wb.SheetNames) {
    const matrix = sheetMatrix(wb, name);
    if (/^по \d{2}\.\d{4}/.test(name)) entries.push(...parseNewSheet(matrix, name, skipped));
    else if (/^по \d{4}/.test(name)) entries.push(...parseOldSheet(matrix, name, skipped));
    else console.log(`→ лист «${name}» не распознан — пропущен целиком`);
  }

  // Дедупликация между листами (новые листы идут в файле первыми и выигрывают).
  const seen = new Set<string>();
  const unique = entries.filter((e) => {
    const key = [e.guest.toLowerCase(), e.amount, wallKey(e.paid), wallKey(e.visit)].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Сводка для сверки с экселем.
  const byMonth = new Map<string, {sum: number; n: number}>();
  for (const e of unique) {
    const m = `${e.paid.y}-${String(e.paid.m).padStart(2, '0')}`;
    const agg = byMonth.get(m) ?? {sum: 0, n: 0};
    agg.sum += e.amount;
    agg.n += 1;
    byMonth.set(m, agg);
  }
  const total = unique.reduce((s, e) => s + e.amount, 0);
  console.log(`Распознано строк: ${entries.length}, после дедупликации: ${unique.length}, пропущено: ${skipped.length}`);
  console.log(`Общая сумма: ${total.toLocaleString('ru-RU')} ₸`);
  console.log('Суммы по месяцам (дата оплаты):');
  for (const [m, {sum, n}] of Array.from(byMonth.entries()).sort()) {
    console.log(`  ${m}: ${sum.toLocaleString('ru-RU')} ₸ (${n} шт.)`);
  }
  if (skipped.length) {
    console.log('Пропущенные строки (без суммы/даты):');
    skipped.slice(0, 15).forEach((s) => console.log('  ', s));
    if (skipped.length > 15) console.log(`   … и ещё ${skipped.length - 15}`);
  }
  if (dryRun) {
    console.log('\n--dry-run: в базу ничего не записано.');
    return;
  }

  let created = 0;
  let existed = 0;
  for (const e of unique) {
    const paidAt = almaty(e.paid, 12);
    const visitAt = almaty(e.visit, 0);
    if (Number.isNaN(paidAt.getTime()) || Number.isNaN(visitAt.getTime())) {
      console.log(`  ! кривая дата, пропуск: ${e.sheet} / ${e.guest} / ${wallKey(e.paid)}→${wallKey(e.visit)}`);
      continue;
    }
    const dup = await prisma.prepaymentArchive.findFirst({
      where: {guest: e.guest, amount: e.amount, paidAt, visitAt},
      select: {id: true},
    });
    if (dup) {
      existed += 1;
      continue;
    }
    await prisma.prepaymentArchive.create({
      data: {
        amount: e.amount,
        paymentMethod: mapPayment(e.typeRaw),
        guest: e.guest,
        resourceLabel: e.vipRaw,
        paidAt,
        visitAt,
        note: e.note || null,
        manager: e.manager || null,
      },
    });
    created += 1;
  }
  console.log(`\nГотово: создано записей архива ${created}, уже были (пропущено) ${existed}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
