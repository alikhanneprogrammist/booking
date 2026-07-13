// Разовый импорт исторических предоплат из эксель-журнала бухгалтерии (ПРЕДОПЛАТЫ.xlsx).
// Строки превращаются в брони нулевой длительности [X, X): они видны на вкладке
// «Предоплаты» (по prepaidAt), но не попадают в календарь и не конфликтуют
// с exclusion-констрейнтом booking_no_overlap (пустой интервал ни с чем не пересекается).
//
// Запуск (из booking/, DATABASE_URL из .env):
//   npx tsx scripts/import-prepayments.ts "../ПРЕДОПЛАТЫ.xlsx" --dry-run   # проверка без записи
//   npx tsx scripts/import-prepayments.ts "../ПРЕДОПЛАТЫ.xlsx"             # импорт
//
// Идемпотентно: уже импортированные строки (тот же клиент+сумма+даты) пропускаются.

import {PrismaClient, PaymentMethod} from '@prisma/client';
import * as XLSX from 'xlsx';
import bcrypt from 'bcryptjs';
import {randomBytes} from 'node:crypto';
import {fromZonedTime} from 'date-fns-tz';
import {TIMEZONE} from '../lib/time';

const prisma = new PrismaClient();

// ─────────────────────────── Маппинг (правится здесь) ───────────────────────

// «VIP №» из экселя → nameRu ресурса в БД. Всё, что не смэпилось (VIP 1, VIP 0,
// пусто), уходит на скрытый служебный ресурс ARCHIVE_RESOURCE.
const VIP_TO_RESOURCE: Record<string, string> = {
  '2': '2/5 VIP',
  '5': '2/5 VIP',
  '3': '3/4 VIP',
  '4': '3/4 VIP',
  '6': '6 VIP',
  '7': '7 VIP',
};
const BANQUET_RE = /б\s*[/.]\s*з|банкет/i; // «Б/з», «Б.З», «Банкетный зал»
const ARCHIVE_RESOURCE = 'Архив (импорт)';

const PAYMENT_MAP: Array<[RegExp, PaymentMethod]> = [
  [/kaspi|пэй|пей/i, 'KASPI'],
  [/нал/i, 'CASH'],
  [/банк|перевод/i, 'BANK'],
];

// Синтетические телефоны (обязательны и уникальны по схеме): диапазоны,
// невозможные у реальных номеров.
const CLIENT_PHONE_PREFIX = '+7000';
const USER_PHONE_PREFIX = '+79990';

// ─────────────────────────── Парсинг ────────────────────────────────────────

type Wall = {y: number; m: number; d: number};

type Entry = {
  amount: number;
  typeRaw: string;
  guest: string;
  vipRaw: string; // текст, из которого определяем зал (VIP № или «Списание»)
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

// ─────────────────────────── Маппинг значений ───────────────────────────────

function mapPayment(typeRaw: string): PaymentMethod | null {
  for (const [re, method] of PAYMENT_MAP) if (re.test(typeRaw)) return method;
  return null;
}

// Возвращает nameRu ресурса или null (→ архив).
function mapResourceName(vipRaw: string): string | null {
  if (BANQUET_RE.test(vipRaw)) return 'Банкетный';
  const digit = vipRaw.match(/(\d)\s*вип/i) ?? vipRaw.match(/вип\s*(\d)/i) ?? vipRaw.match(/(\d)/);
  return digit ? (VIP_TO_RESOURCE[digit[1]] ?? null) : null;
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
  let toArchive = 0;
  for (const e of unique) {
    const m = `${e.paid.y}-${String(e.paid.m).padStart(2, '0')}`;
    const agg = byMonth.get(m) ?? {sum: 0, n: 0};
    agg.sum += e.amount;
    agg.n += 1;
    byMonth.set(m, agg);
    if (!mapResourceName(e.vipRaw)) toArchive += 1;
  }
  console.log(`Распознано строк: ${entries.length}, после дедупликации: ${unique.length}, пропущено: ${skipped.length}`);
  console.log(`Без зала (уйдут на «${ARCHIVE_RESOURCE}»): ${toArchive}`);
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

  // Ресурсы: существующие + служебный архивный (скрыт из календаря/форм).
  const resources = await prisma.resource.findMany();
  const resourceByName = new Map(resources.map((r) => [r.nameRu, r.id]));
  if (!resourceByName.has(ARCHIVE_RESOURCE)) {
    const archive = await prisma.resource.create({
      data: {
        kind: 'COMPLEX', nameRu: ARCHIVE_RESOURCE, nameKk: ARCHIVE_RESOURCE,
        capacity: 0, isActive: false, sortOrder: 999, hourlyPrice: 0,
      },
    });
    resourceByName.set(ARCHIVE_RESOURCE, archive.id);
    console.log(`→ создан служебный ресурс «${ARCHIVE_RESOURCE}»`);
  }
  const required = Array.from(new Set(Object.values(VIP_TO_RESOURCE).concat('Банкетный')));
  const missing = required.filter((n) => !resourceByName.has(n));
  if (missing.length) {
    console.error(`В БД нет ресурсов: ${missing.join(', ')} — поправь VIP_TO_RESOURCE в скрипте.`);
    process.exit(1);
  }

  // Кэши клиентов/сотрудников по имени (идемпотентность повторных запусков).
  const importedClients = await prisma.client.findMany({where: {phone: {startsWith: CLIENT_PHONE_PREFIX}}});
  const clientByName = new Map(importedClients.map((c) => [c.name.toLowerCase(), c.id]));
  let clientSeq = importedClients.length;
  async function clientId(name: string): Promise<string> {
    const key = name.toLowerCase();
    const hit = clientByName.get(key);
    if (hit) return hit;
    let phone: string;
    do phone = `${CLIENT_PHONE_PREFIX}${String(++clientSeq).padStart(6, '0')}`;
    while (await prisma.client.findUnique({where: {phone}}));
    const c = await prisma.client.create({data: {name, phone, tags: ['импорт']}});
    clientByName.set(key, c.id);
    return c.id;
  }

  const allUsers = await prisma.user.findMany();
  const userByName = new Map(allUsers.map((u) => [u.name.toLowerCase(), u.id]));
  let userSeq = allUsers.filter((u) => u.phone.startsWith(USER_PHONE_PREFIX)).length;
  async function userId(name: string): Promise<string> {
    const key = (name || 'Импорт (эксель)').toLowerCase();
    const hit = userByName.get(key);
    if (hit) return hit;
    let phone: string;
    do phone = `${USER_PHONE_PREFIX}${String(++userSeq).padStart(6, '0')}`;
    while (await prisma.user.findUnique({where: {phone}}));
    const u = await prisma.user.create({
      data: {
        name: name || 'Импорт (эксель)', phone, role: 'MANAGER', isActive: false,
        passwordHash: await bcrypt.hash(randomBytes(24).toString('hex'), 10),
      },
    });
    userByName.set(key, u.id);
    return u.id;
  }

  let created = 0;
  let existed = 0;
  for (const e of unique) {
    const cid = await clientId(e.guest);
    const uid = await userId(e.manager);
    const startAt = almaty(e.visit, 0); // [X, X) — пустой интервал, см. шапку файла
    const prepaidAt = almaty(e.paid, 12);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(prepaidAt.getTime())) {
      console.log(`  ! кривая дата, пропуск: ${e.sheet} / ${e.guest} / ${wallKey(e.paid)}→${wallKey(e.visit)}`);
      continue;
    }
    const dup = await prisma.booking.findFirst({
      where: {clientId: cid, startAt, prepaidAt, prepayment: e.amount},
      select: {id: true},
    });
    if (dup) {
      existed += 1;
      continue;
    }
    await prisma.booking.create({
      data: {
        resourceId: resourceByName.get(mapResourceName(e.vipRaw) ?? ARCHIVE_RESOURCE)!,
        clientId: cid,
        startAt,
        endAt: startAt,
        status: 'COMPLETED',
        source: 'ADMIN',
        tariff: 'CUSTOM',
        guests: 1,
        total: 0,
        prepayment: e.amount,
        prepaidAt,
        paymentMethod: mapPayment(e.typeRaw),
        comment: e.note || null,
        createdById: uid,
      },
    });
    created += 1;
  }
  console.log(`\nГотово: создано броней ${created}, уже были (пропущено) ${existed}.`);
  console.log(`Клиентов с тегом «импорт»: ${clientByName.size}; сотрудников-ответственных: ${userByName.size}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
