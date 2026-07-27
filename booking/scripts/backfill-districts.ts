// Разовое проставление районов заказам доставки из эксель-файла «Тепловая карта»
// (листы-месяцы: колонка A — адрес, B — район). Обновляются только записи с
// ПУСТЫМ районом — вручную выбранные районы не перетираются.
//
// Запуск (из booking/):
//   npx tsx scripts/backfill-districts.ts ../Теплова*.xlsx --dry-run
//   npx tsx scripts/backfill-districts.ts ../Теплова*.xlsx
//
// На проде — внутри контейнера:
//   docker compose run --rm -v "$(readlink -f ../Теплова*.xlsx):/data/heatmap.xlsx:ro" \
//     app npx tsx scripts/backfill-districts.ts /data/heatmap.xlsx

import {PrismaClient} from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

// Названия районов в файле → канонические значения DELIVERY_DISTRICTS.
const DISTRICT_MAP: Array<[RegExp, string]> = [
  [/^нур/i, 'Нуринский'],
  [/^сарыарк/i, 'Сарыаркинский'],
  [/^байкон/i, 'Байконурский'],
  [/^алмат/i, 'Алматинский'],
  [/^еси/i, 'Есильский'],
  [/^сарайш/i, 'Сарайшык'],
];

function canonDistrict(raw: string): string | null {
  const s = raw.trim();
  for (const [re, canon] of DISTRICT_MAP) if (re.test(s)) return canon;
  return null;
}

// Нормализация адреса для сопоставления: нижний регистр, только буквы/цифры.
function normAddr(s: string): string {
  return s.toLowerCase().replaceAll('ё', 'е').replace(/[^a-zа-я0-9]/gi, '');
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('Использование: npx tsx scripts/backfill-districts.ts <файл.xlsx> [--dry-run]');
    process.exit(1);
  }

  // Пары адрес → район со всех листов файла.
  const wb = XLSX.readFile(file);
  const pairs: Array<{addr: string; norm: string; district: string}> = [];
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], {header: 1, raw: false});
    for (const r of rows) {
      const addr = String(r?.[0] ?? '').trim();
      const distRaw = String(r?.[1] ?? '').trim();
      if (!addr || !distRaw || addr === 'Адрес') continue;
      const district = canonDistrict(distRaw);
      if (!district) {
        console.log(`  ? район не распознан: «${distRaw}» (${addr})`);
        continue;
      }
      const norm = normAddr(addr);
      if (norm.length >= 4) pairs.push({addr, norm, district});
    }
  }
  console.log(`Пар адрес→район в файле: ${pairs.length}`);

  const orders = await prisma.deliveryOrder.findMany({
    where: {district: null, address: {not: null}},
    select: {id: true, address: true},
  });
  console.log(`Заказов без района в базе: ${orders.length}`);

  let matched = 0;
  const unmatched: string[] = [];
  for (const o of orders) {
    const norm = normAddr(o.address!);
    if (norm.length < 4) {
      unmatched.push(o.address!);
      continue;
    }
    // Совпадение: равенство или вложение нормализованных адресов.
    const hit = pairs.find((p) => p.norm === norm || p.norm.includes(norm) || norm.includes(p.norm));
    if (!hit) {
      unmatched.push(o.address!);
      continue;
    }
    matched += 1;
    console.log(`  ✓ «${o.address}» → ${hit.district} (по «${hit.addr}»)`);
    if (!dryRun) {
      await prisma.deliveryOrder.update({where: {id: o.id}, data: {district: hit.district}});
    }
  }

  console.log(`\nСопоставлено: ${matched}, не найдено: ${unmatched.length}`);
  if (unmatched.length) {
    console.log('Без района остались (проставить вручную):');
    unmatched.forEach((a) => console.log('   ', a));
  }
  if (dryRun) console.log('\n--dry-run: в базу ничего не записано.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
