// Seed реальных данных OFFICE 2020 (ТЗ §5.8).
// Источник данных — lib/mock-data.ts (форма уже совпадает с Prisma-моделями),
// чтобы не дублировать справочники между моками и БД.
// Запуск: npm run db:seed (после npm run db:migrate).

import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'crypto';
import bcrypt from 'bcryptjs';
import {
  MOCK_RESOURCES,
  MOCK_ADDONS,
  MOCK_USERS,
  MOCK_CLIENTS,
  MOCK_BOOKINGS,
} from '../lib/mock-data';

const prisma = new PrismaClient();

// Демо-пароль для всех сотрудников. ТЗ §5.8: обязательная смена при внедрении.
const DEMO_PASSWORD = 'office2020';

// Фиксированный id служебного аккаунта онлайн-заявок (см. lib/public-actions.ts).
const ONLINE_USER_ID = 'u-online';

async function main() {
  // Идемпотентность: чистим в порядке зависимостей (дочерние → родительские).
  await prisma.bookingAddon.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.serviceAddon.deleteMany();
  await prisma.client.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.user.deleteMany();

  // ───────────────── Сотрудники (1 ADMIN + 3 MANAGER) ─────────────────
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const u of MOCK_USERS) {
    await prisma.user.create({
      data: {
        id: u.id,
        name: u.name,
        phone: u.phone,
        email: u.email ?? null,
        passwordHash,
        role: u.role,
        isActive: u.isActive,
      },
    });
  }

  // Служебный аккаунт для онлайн-заявок (виджет /book). Войти под ним нельзя
  // (isActive=false) — он только цель FK createdById у публичных броней.
  await prisma.user.create({
    data: {
      id: ONLINE_USER_ID,
      name: 'Онлайн-заявки',
      phone: 'online',
      passwordHash: await bcrypt.hash(randomUUID(), 10),
      role: 'MANAGER',
      isActive: false,
    },
  });

  // ───────────────── Объекты (5 реальных, ТЗ §5.8) ────────────────────
  for (const r of MOCK_RESOURCES) {
    await prisma.resource.create({
      data: {
        id: r.id,
        kind: r.kind,
        nameRu: r.nameRu,
        nameKk: r.nameKk,
        capacity: r.capacity,
        color: r.color,
        photos: r.photos,
        isActive: r.isActive,
        sortOrder: r.sortOrder,
        floors: r.floors,
        hasKaraoke: r.hasKaraoke,
        hasFinnishSauna: r.hasFinnishSauna,
        hasHammam: r.hasHammam,
        hasPool: r.hasPool,
        hasBanquet: r.hasBanquet,
        restRooms: r.restRooms,
        hasKitchen: r.hasKitchen,
        hourlyPrice: r.hourlyPrice,
        minHours: r.minHours,
        halfDayPrice: r.halfDayPrice,
        fullDayPrice: r.fullDayPrice,
        weekendPrice: r.weekendPrice,
        weekdayMinDeposit: r.weekdayMinDeposit,
        priceNote: r.priceNote ?? null,
      },
    });
  }

  // ───────────────── Доп.услуги ───────────────────────────────────────
  for (const a of MOCK_ADDONS) {
    await prisma.serviceAddon.create({
      data: {
        id: a.id,
        nameRu: a.nameRu,
        nameKk: a.nameKk,
        price: a.price,
        unit: a.unit,
      },
    });
  }

  // ───────────────── Клиенты ──────────────────────────────────────────
  for (const c of MOCK_CLIENTS) {
    await prisma.client.create({
      data: {
        id: c.id,
        name: c.name,
        phone: c.phone,
        note: c.note ?? null,
        tags: c.tags ?? [],
        dateOfBirth: c.dateOfBirth ?? null,
      },
    });
  }

  // ───────────────── Демо-брони (createdBy = ADMIN) ───────────────────
  const adminId = MOCK_USERS.find((u) => u.role === 'ADMIN')!.id;
  for (const b of MOCK_BOOKINGS) {
    await prisma.booking.create({
      data: {
        id: b.id,
        resourceId: b.resourceId,
        clientId: b.clientId,
        startAt: b.startAt,
        endAt: b.endAt,
        status: b.status,
        source: b.source,
        tariff: b.tariff,
        guests: b.guests,
        total: b.total,
        deposit: b.deposit,
        prepayment: b.prepayment,
        discountType: b.discountType,
        discountValue: b.discountValue,
        comment: b.comment ?? null,
        createdById: adminId,
        addons: {
          create: b.addons.map((ba) => ({
            addonId: ba.addonId,
            qty: ba.qty,
            priceAtBooking: ba.priceAtBooking,
          })),
        },
      },
    });
  }

  const counts = {
    users: MOCK_USERS.length,
    resources: MOCK_RESOURCES.length,
    addons: MOCK_ADDONS.length,
    clients: MOCK_CLIENTS.length,
    bookings: MOCK_BOOKINGS.length,
  };
  console.log('Seed выполнен:', counts);
  console.log(`Демо-вход: телефон ${MOCK_USERS[0].phone} / пароль ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
