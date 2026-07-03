import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {prisma} from '@/lib/db';
import {createBooking, updateBooking, cancelBooking, BookingError} from '@/lib/bookings';
import {getSettings} from '@/lib/queries';

/**
 * Интеграционные тесты домена броней на живой БД (DATABASE_URL из .env).
 * Фикстуры создаются в далёком будущем (2041 год) и удаляются в afterAll —
 * реальные данные не трогаются; нужен посеянный справочник (объект/клиент/юзер).
 */

const Y = 2041;
// 9 января 2041 — среда (будни): тарифная логика предсказуема.
const at = (day: number, hourUtc: number) => new Date(Date.UTC(Y, 0, day, hourUtc));

let resourceId: string;
let clientId: string;
let adminId: string;
let addonId: string;
const created: string[] = [];

async function mkBooking(over: Record<string, unknown> = {}) {
  const {booking} = await createBooking(
    {
      resourceId,
      clientId,
      startAt: at(9, 5), // 10:00 Алматы
      endAt: at(9, 9), // 14:00 Алматы (4 ч)
      tariff: 'HOURLY',
      ...over,
    } as never,
    adminId,
  );
  created.push(booking.id);
  return booking;
}

beforeAll(async () => {
  await prisma.$queryRaw`SELECT 1`; // явная ошибка, если БД не поднята
  const res = await prisma.resource.findFirst({orderBy: {sortOrder: 'asc'}});
  const client = await prisma.client.findFirst();
  const admin = await prisma.user.findFirst({where: {role: 'ADMIN'}});
  const addon = await prisma.serviceAddon.findFirst();
  if (!res || !client || !admin || !addon) {
    throw new Error('Нужны посеянные данные: npm run db:seed');
  }
  resourceId = res.id;
  clientId = client.id;
  adminId = admin.id;
  addonId = addon.id;
});

afterAll(async () => {
  if (created.length) await prisma.booking.deleteMany({where: {id: {in: created}}});
  await prisma.$disconnect();
});

describe('createBooking', () => {
  it('создаёт бронь с авторасчётом суммы', async () => {
    const b = await mkBooking();
    expect(Number(b.total)).toBeGreaterThan(0);
    expect(b.status).toBe('NEW');
  });

  it('пересечение отбивается барьером приложения (OVERLAP)', async () => {
    // 4 часа (не короче минимума), пересекает бронь 5–9 наполовину
    await expect(mkBooking({startAt: at(9, 7), endAt: at(9, 11)})).rejects.toMatchObject({
      code: 'OVERLAP',
    });
  });

  it('касание конца [start,end) — НЕ пересечение', async () => {
    const b = await mkBooking({startAt: at(9, 9), endAt: at(9, 13)});
    expect(b.id).toBeTruthy();
  });

  it('короче эффективного минимума → MIN_DURATION', async () => {
    const settings = await getSettings();
    const res = await prisma.resource.findUnique({where: {id: resourceId}});
    const floor = Math.max(res!.minHours, settings.minBookingHours);
    const tooShort = mkBooking({
      startAt: at(11, 5),
      endAt: new Date(at(11, 5).getTime() + (floor - 0.5) * 3600_000),
    });
    await expect(tooShort).rejects.toMatchObject({code: 'MIN_DURATION'});
  });

  it('конец раньше начала → INVALID_RANGE', async () => {
    await expect(mkBooking({startAt: at(12, 9), endAt: at(12, 5)})).rejects.toMatchObject({
      code: 'INVALID_RANGE',
    });
  });

  it('несуществующий объект → RESOURCE_NOT_FOUND', async () => {
    await expect(mkBooking({resourceId: 'nope', startAt: at(13, 5), endAt: at(13, 9)}))
      .rejects.toMatchObject({code: 'RESOURCE_NOT_FOUND'});
  });

  it('CANCELLED освобождает слот', async () => {
    const b = await mkBooking({startAt: at(14, 5), endAt: at(14, 9)});
    await cancelBooking(b.id);
    const again = await mkBooking({startAt: at(14, 5), endAt: at(14, 9)});
    expect(again.id).not.toBe(b.id);
  });
});

describe('updateBooking (частичные патчи)', () => {
  it('патч только статуса не трогает услуги, сумму и время', async () => {
    const b = await mkBooking({
      startAt: at(16, 5),
      endAt: at(16, 9),
      tariff: 'CUSTOM',
      total: 500_000,
      addons: [{addonId, qty: 2, priceAtBooking: 10_000}],
    });
    await updateBooking(b.id, {status: 'CONFIRMED'});
    const after = await prisma.booking.findUnique({where: {id: b.id}, include: {addons: true}});
    expect(after!.status).toBe('CONFIRMED');
    expect(after!.addons).toHaveLength(1);
    expect(Number(after!.total)).toBe(500_000);
    expect(after!.startAt.toISOString()).toBe(at(16, 5).toISOString());
  });

  it('смена времени без total → сервер пересчитывает (4ч → 6ч = ×1.5)', async () => {
    const b = await mkBooking({startAt: at(18, 5), endAt: at(18, 9), prepayment: 7777});
    const before = Number(b.total);
    await updateBooking(b.id, {endAt: at(18, 11)});
    const after = await prisma.booking.findUnique({where: {id: b.id}});
    expect(Number(after!.total)).toBe(before * 1.5);
    expect(Number(after!.prepayment)).toBe(7777); // договорная предоплата не трогается
  });

  it('явный total уважается, отрицательный — отбивается', async () => {
    const b = await mkBooking({startAt: at(20, 5), endAt: at(20, 9)});
    await updateBooking(b.id, {total: 999_000});
    expect(Number((await prisma.booking.findUnique({where: {id: b.id}}))!.total)).toBe(999_000);
    await expect(updateBooking(b.id, {total: -1})).rejects.toThrow();
  });

  it('перенос на занятый слот → OVERLAP', async () => {
    const a = await mkBooking({startAt: at(22, 5), endAt: at(22, 9)});
    const b = await mkBooking({startAt: at(22, 10), endAt: at(22, 14)});
    await expect(updateBooking(b.id, {startAt: at(22, 6), endAt: at(22, 10)}))
      .rejects.toMatchObject({code: 'OVERLAP'});
    expect(a.id).toBeTruthy();
  });
});

describe('барьер БД (btree_gist exclusion)', () => {
  it('прямая вставка пересечения мимо приложения отбивается констрейнтом', async () => {
    const b = await mkBooking({startAt: at(24, 5), endAt: at(24, 9)});
    const insert = prisma.booking.create({
      data: {
        resourceId,
        clientId,
        startAt: at(24, 6),
        endAt: at(24, 8),
        tariff: 'HOURLY',
        total: 1,
        createdById: adminId,
      },
    });
    await expect(insert).rejects.toThrow(/booking_no_overlap|23P01|exclusion/);
    expect(b.id).toBeTruthy();
  });
});
