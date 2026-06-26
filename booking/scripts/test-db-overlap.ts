// Проверка Stage 2 «Готово» (ТЗ §4.6, барьер БД): прямой INSERT пересекающейся
// брони в обход приложения должен отбиваться exclusion-constraint booking_no_overlap.
// Запуск (после миграций + seed): npm run db:test:overlap

import {PrismaClient, Prisma} from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const resource = await prisma.resource.findFirst({where: {isActive: true}});
  const client = await prisma.client.findFirst();
  const admin = await prisma.user.findFirst({where: {role: 'ADMIN'}});
  if (!resource || !client || !admin) {
    throw new Error('Нет данных seed — сначала npm run db:seed');
  }

  const start = new Date('2026-07-01T10:00:00.000Z');
  const end = new Date('2026-07-01T14:00:00.000Z');
  const overlapStart = new Date('2026-07-01T12:00:00.000Z'); // пересекает [10:00,14:00)
  const overlapEnd = new Date('2026-07-01T16:00:00.000Z');
  const touchStart = end; // касание границей — НЕ пересечение (полуоткрытый интервал)
  const touchEnd = new Date('2026-07-01T18:00:00.000Z');

  // Чистим возможные остатки прошлого прогона.
  await prisma.booking.deleteMany({
    where: {resourceId: resource.id, startAt: {gte: start}, endAt: {lte: touchEnd}},
  });

  const base = {
    resourceId: resource.id,
    clientId: client.id,
    createdById: admin.id,
    guests: 1,
    total: 0,
    deposit: 0,
    prepayment: 0,
  };

  const results: string[] = [];

  // 1. Базовая бронь — создаётся.
  const first = await prisma.booking.create({
    data: {...base, startAt: start, endAt: end},
  });
  results.push('✓ базовая бронь создана');

  // 2. Пересекающаяся — должна быть отбита (23P01).
  let rejected = false;
  try {
    await prisma.booking.create({data: {...base, startAt: overlapStart, endAt: overlapEnd}});
  } catch (e) {
    // Prisma оборачивает нарушение exclusion-constraint в Unknown- (а не Known-)
    // ошибку, поэтому проверяем по тексту, как isOverlapDbError в lib/bookings.ts.
    const isKnownOrUnknown =
      e instanceof Prisma.PrismaClientKnownRequestError ||
      e instanceof Prisma.PrismaClientUnknownRequestError;
    const msg = isKnownOrUnknown ? e.message : e instanceof Error ? e.message : '';
    if (msg.includes('booking_no_overlap') || msg.includes('23P01')) {
      rejected = true;
    } else {
      throw e;
    }
  }
  if (!rejected) throw new Error('✗ пересекающаяся бронь НЕ была отбита БД');
  results.push('✓ пересекающаяся бронь отбита БД (booking_no_overlap)');

  // 3. Касание границей — должно пройти (интервалы полуоткрытые [start,end)).
  const touch = await prisma.booking.create({
    data: {...base, startAt: touchStart, endAt: touchEnd},
  });
  results.push('✓ касание границей разрешено (полуоткрытый интервал)');

  // 4. Та же бронь со статусом CANCELLED поверх занятого слота — должна пройти.
  const cancelled = await prisma.booking.create({
    data: {...base, startAt: overlapStart, endAt: overlapEnd, status: 'CANCELLED'},
  });
  results.push('✓ CANCELLED-бронь поверх занятого слота разрешена');

  // Уборка.
  await prisma.booking.deleteMany({where: {id: {in: [first.id, touch.id, cancelled.id]}}});

  console.log(results.join('\n'));
  console.log('\nStage 2 анти-овербукинг (БД): OK');
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
