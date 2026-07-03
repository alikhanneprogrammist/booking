import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {prisma} from '@/lib/db';
import {createBooking, cancelBooking} from '@/lib/bookings';
import {getBookingsBetween, getBookingsStartingBetween, getVisitCounts} from '@/lib/queries';

/** Интеграция слоя чтения: оконные выборки и счётчик визитов. Фикстуры — 2042 год. */

const Y = 2042;
const at = (day: number, hourUtc: number) => new Date(Date.UTC(Y, 0, day, hourUtc));

let resourceId: string;
let clientId: string;
let adminId: string;
const created: string[] = [];

async function mk(startAt: Date, endAt: Date) {
  const {booking} = await createBooking(
    {resourceId, clientId, startAt, endAt, tariff: 'CUSTOM', total: 1000},
    adminId,
  );
  created.push(booking.id);
  return booking;
}

beforeAll(async () => {
  await prisma.$queryRaw`SELECT 1`;
  const res = await prisma.resource.findFirst({orderBy: {sortOrder: 'asc'}});
  const client = await prisma.client.findFirst();
  const admin = await prisma.user.findFirst({where: {role: 'ADMIN'}});
  if (!res || !client || !admin) throw new Error('Нужны посеянные данные: npm run db:seed');
  resourceId = res.id;
  clientId = client.id;
  adminId = admin.id;
});

afterAll(async () => {
  if (created.length) await prisma.booking.deleteMany({where: {id: {in: created}}});
  await prisma.$disconnect();
});

describe('getBookingsBetween — окно [from, to), пересечение', () => {
  it('включает бронь, пересекающую границу окна; исключает вне окна', async () => {
    // бронь 10 янв 22:00–02:00 (через полночь)
    const b = await mk(at(10, 17), at(10, 21));
    const inWindow = await getBookingsBetween(at(10, 20), at(11, 0));
    expect(inWindow.some((x) => x.id === b.id)).toBe(true); // хвост попадает
    const outside = await getBookingsBetween(at(12, 0), at(13, 0));
    expect(outside.some((x) => x.id === b.id)).toBe(false);
    // касание границы: окно начинается ровно в endAt → не входит (полуоткрыто)
    const touching = await getBookingsBetween(at(10, 21), at(11, 5));
    expect(touching.some((x) => x.id === b.id)).toBe(false);
  });
});

describe('getBookingsStartingBetween — атрибуция по началу', () => {
  it('фильтр по startAt: [from, to)', async () => {
    const b = await mk(at(15, 10), at(15, 14));
    expect((await getBookingsStartingBetween(at(15, 0), at(16, 0))).some((x) => x.id === b.id)).toBe(true);
    expect((await getBookingsStartingBetween(at(15, 11), at(16, 0))).some((x) => x.id === b.id)).toBe(false);
    expect((await getBookingsStartingBetween(at(14, 0), at(15, 10))).some((x) => x.id === b.id)).toBe(false);
  });
});

describe('getVisitCounts', () => {
  it('активная бронь увеличивает счётчик, отменённая — нет', async () => {
    const before = (await getVisitCounts())[clientId] ?? 0;
    const b = await mk(at(20, 10), at(20, 14));
    expect((await getVisitCounts())[clientId]).toBe(before + 1);
    await cancelBooking(b.id);
    expect((await getVisitCounts())[clientId] ?? 0).toBe(before);
  });
});
