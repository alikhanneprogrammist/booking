// Откат разового импорта исторических предоплат (scripts/import-prepayments.ts).
// Удаляет всё, что создал импорт, по его же синтетическим признакам:
//   - брони клиентов с телефонами +7000…  (клиенты создавались только импортом);
//   - самих этих клиентов (тег «импорт»);
//   - неактивных сотрудников-«ответственных» с телефонами +79990…;
//   - служебный ресурс «Архив (импорт)», если остался пустым.
// Реальные данные не трогает: настоящие телефоны с +7000/+79990 начинаться не могут,
// а сотрудники, совпавшие по имени с реальными пользователями, не удаляются.
//
// Запуск (из booking/, DATABASE_URL из .env):
//   npx tsx scripts/remove-imported-prepayments.ts --dry-run   # показать, без удаления
//   npx tsx scripts/remove-imported-prepayments.ts             # удалить (с бэкапом в JSON)

import {PrismaClient} from '@prisma/client';
import {writeFileSync} from 'node:fs';

const prisma = new PrismaClient();

const CLIENT_PHONE_PREFIX = '+7000';
const USER_PHONE_PREFIX = '+79990';
const ARCHIVE_RESOURCE = 'Архив (импорт)';

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const clients = await prisma.client.findMany({
    where: {phone: {startsWith: CLIENT_PHONE_PREFIX}},
    select: {id: true, name: true, phone: true, tags: true},
  });
  const clientIds = clients.map((c) => c.id);

  const bookings = await prisma.booking.findMany({
    where: {clientId: {in: clientIds}},
    include: {resource: {select: {nameRu: true}}, client: {select: {name: true}}},
  });

  const users = await prisma.user.findMany({
    where: {phone: {startsWith: USER_PHONE_PREFIX}, isActive: false},
    select: {id: true, name: true, phone: true},
  });

  const archive = await prisma.resource.findFirst({
    where: {nameRu: ARCHIVE_RESOURCE},
    select: {id: true, nameRu: true},
  });

  const totalPrepay = bookings.reduce((s, b) => s + Number(b.prepayment ?? 0), 0);
  const nonEmpty = bookings.filter((b) => b.startAt.getTime() !== b.endAt.getTime());
  console.log(`Броней импорта (по клиентам ${CLIENT_PHONE_PREFIX}…): ${bookings.length}`);
  console.log(`  сумма предоплат: ${totalPrepay.toLocaleString('ru-RU')} ₸`);
  if (nonEmpty.length) {
    console.log(`  ! из них НЕ нулевой длительности (проверьте вручную): ${nonEmpty.length}`);
    nonEmpty.slice(0, 10).forEach((b) =>
      console.log(`    ${b.id} ${b.client.name} ${b.startAt.toISOString()}–${b.endAt.toISOString()}`)
    );
  }
  console.log(`Клиентов импорта: ${clients.length}`);
  console.log(`Сотрудников импорта (${USER_PHONE_PREFIX}…, неактивные): ${users.length}`);
  console.log(`Ресурс «${ARCHIVE_RESOURCE}»: ${archive ? 'есть' : 'нет'}`);

  if (dryRun) {
    console.log('\n--dry-run: ничего не удалено.');
    return;
  }

  const backupPath = `${process.cwd()}/prepayments-import-backup-${new Date()
    .toISOString()
    .replace(/[:.]/g, '-')}.json`;
  writeFileSync(backupPath, JSON.stringify({clients, bookings, users, archive}, null, 2));
  console.log(`\nБэкап удаляемого: ${backupPath}`);

  const delBookings = await prisma.booking.deleteMany({where: {clientId: {in: clientIds}}});
  const delClients = await prisma.client.deleteMany({where: {id: {in: clientIds}}});

  // Сотрудников удаляем только если на них больше не ссылаются другие брони.
  let delUsers = 0;
  for (const u of users) {
    const refs = await prisma.booking.count({where: {createdById: u.id}});
    if (refs > 0) {
      console.log(`  ! сотрудник ${u.name} (${u.phone}) ещё указан в ${refs} бронях — оставлен`);
      continue;
    }
    await prisma.user.delete({where: {id: u.id}});
    delUsers += 1;
  }

  let archiveMsg = 'не было';
  if (archive) {
    const refs = await prisma.booking.count({where: {resourceId: archive.id}});
    if (refs > 0) {
      archiveMsg = `оставлен — на нём ещё ${refs} броней`;
    } else {
      await prisma.resource.delete({where: {id: archive.id}});
      archiveMsg = 'удалён';
    }
  }

  console.log(
    `\nГотово: броней удалено ${delBookings.count}, клиентов ${delClients.count}, ` +
      `сотрудников ${delUsers}; ресурс «${ARCHIVE_RESOURCE}» — ${archiveMsg}.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
