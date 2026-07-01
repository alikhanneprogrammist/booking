import {prisma} from './db';
import type {
  MockResource, MockAddon, MockClient, MockUser, MockWaiter, MockBooking,
} from './mock-data';
import {DEFAULT_SETTINGS, SETTINGS_ID, type AppSettings} from './settings';

/**
 * Серверный слой чтения (этап 2): запросы Prisma → DTO в форме Mock*-типов
 * (Decimal → number, Json floors → string[]), чтобы клиентские компоненты
 * остались без изменений. Вызывается из серверных страниц.
 */

const num = (d: unknown): number => Number(d as never);
const numOrNull = (d: unknown): number | null => (d == null ? null : Number(d as never));

type ResourceRow = Awaited<ReturnType<typeof prisma.resource.findMany>>[number];
type AddonRow = Awaited<ReturnType<typeof prisma.serviceAddon.findMany>>[number];
type ClientRow = Awaited<ReturnType<typeof prisma.client.findMany>>[number];
type UserRow = Awaited<ReturnType<typeof prisma.user.findMany>>[number];
type WaiterRow = Awaited<ReturnType<typeof prisma.waiter.findMany>>[number];

export function toResource(r: ResourceRow): MockResource {
  return {
    id: r.id,
    kind: r.kind,
    nameRu: r.nameRu,
    nameKk: r.nameKk,
    capacity: r.capacity,
    color: r.color,
    photos: r.photos,
    isActive: r.isActive,
    sortOrder: r.sortOrder,
    floors: (r.floors as string[] | null) ?? [],
    hasKaraoke: r.hasKaraoke,
    hasFinnishSauna: r.hasFinnishSauna,
    hasHammam: r.hasHammam,
    hasPool: r.hasPool,
    hasBanquet: r.hasBanquet,
    restRooms: r.restRooms,
    hasKitchen: r.hasKitchen,
    hourlyPrice: num(r.hourlyPrice),
    minHours: r.minHours,
    halfDayPrice: numOrNull(r.halfDayPrice),
    fullDayPrice: numOrNull(r.fullDayPrice),
    weekendPrice: numOrNull(r.weekendPrice),
    weekdayMinDeposit: numOrNull(r.weekdayMinDeposit),
    priceNote: r.priceNote ?? undefined,
  };
}

export function toAddon(a: AddonRow): MockAddon {
  return {id: a.id, nameRu: a.nameRu, nameKk: a.nameKk, price: num(a.price), unit: a.unit};
}

export function toClient(c: ClientRow): MockClient {
  return {
    id: c.id, name: c.name, phone: c.phone, note: c.note ?? undefined, tags: c.tags,
    dateOfBirth: c.dateOfBirth ?? undefined,
  };
}

export function toUser(u: UserRow): MockUser {
  return {
    id: u.id, name: u.name, phone: u.phone, email: u.email ?? undefined,
    role: u.role, isActive: u.isActive,
  };
}

export function toWaiter(w: WaiterRow): MockWaiter {
  return {id: w.id, name: w.name, isActive: w.isActive, sortOrder: w.sortOrder};
}

type BookingRow = Awaited<
  ReturnType<typeof prisma.booking.findMany<{include: {addons: true; waiter: true}}>>
>[number];

export function toBooking(b: BookingRow): MockBooking {
  return {
    id: b.id,
    resourceId: b.resourceId,
    clientId: b.clientId,
    startAt: b.startAt,
    endAt: b.endAt,
    status: b.status,
    source: b.source,
    tariff: b.tariff,
    guests: b.guests,
    total: num(b.total),
    deposit: num(b.deposit),
    prepayment: num(b.prepayment),
    discountType: b.discountType,
    discountValue: num(b.discountValue),
    comment: b.comment ?? undefined,
    waiterId: b.waiterId ?? undefined,
    waiterName: b.waiter?.name ?? undefined,
    addons: b.addons.map((a) => ({
      addonId: a.addonId,
      qty: a.qty,
      priceAtBooking: num(a.priceAtBooking),
    })),
  };
}

// ───────────────────────── Запросы ────────────────────────────────────

export async function getResources(): Promise<MockResource[]> {
  const rows = await prisma.resource.findMany({orderBy: {sortOrder: 'asc'}});
  return rows.map(toResource);
}

export async function getAddons(): Promise<MockAddon[]> {
  const rows = await prisma.serviceAddon.findMany({orderBy: {sortOrder: 'asc'}});
  return rows.map(toAddon);
}

export async function getClients(): Promise<MockClient[]> {
  const rows = await prisma.client.findMany({orderBy: {name: 'asc'}});
  return rows.map(toClient);
}

export async function getClientById(id: string): Promise<MockClient | null> {
  const c = await prisma.client.findUnique({where: {id}});
  return c ? toClient(c) : null;
}

export async function getUsers(): Promise<MockUser[]> {
  const rows = await prisma.user.findMany({orderBy: {createdAt: 'asc'}});
  return rows.map(toUser);
}

export async function getWaiters(): Promise<MockWaiter[]> {
  const rows = await prisma.waiter.findMany({orderBy: [{sortOrder: 'asc'}, {name: 'asc'}]});
  return rows.map(toWaiter);
}

/** Все брони (единый венчур, объём небольшой; фильтрация по дате — на клиенте). */
export async function getBookings(): Promise<MockBooking[]> {
  const rows = await prisma.booking.findMany({
    include: {addons: true, waiter: true},
    orderBy: {startAt: 'asc'},
  });
  return rows.map(toBooking);
}

/**
 * Настройки заведения (singleton). Если строки ещё нет — возвращаем дефолты,
 * не записывая в БД (запись только через saveSettings из админки).
 * null-поля БД → пустая строка, чтобы формы/публичная страница работали без проверок.
 */
export async function getSettings(): Promise<AppSettings> {
  const row = await prisma.settings.findUnique({where: {id: SETTINGS_ID}});
  if (!row) return {...DEFAULT_SETTINGS};
  return {
    companyName: row.companyName,
    logoUrl: row.logoUrl ?? '',
    minBookingHours: row.minBookingHours,
    prepaymentPercent: row.prepaymentPercent,
    phone: row.phone ?? '',
    whatsapp: row.whatsapp ?? '',
    instagram: row.instagram ?? '',
    email: row.email ?? '',
    address: row.address ?? '',
    requisites: row.requisites ?? '',
    publicTitleRu: row.publicTitleRu ?? '',
    publicTitleKk: row.publicTitleKk ?? '',
    publicSubtitleRu: row.publicSubtitleRu ?? '',
    publicSubtitleKk: row.publicSubtitleKk ?? '',
    publicInfoRu: row.publicInfoRu ?? '',
    publicInfoKk: row.publicInfoKk ?? '',
    publicContacts: row.publicContacts ?? '',
  };
}

/** История броней клиента (по убыванию даты) — для карточки клиента. */
export async function getClientBookings(clientId: string): Promise<MockBooking[]> {
  const rows = await prisma.booking.findMany({
    where: {clientId},
    include: {addons: true, waiter: true},
    orderBy: {startAt: 'desc'},
  });
  return rows.map(toBooking);
}
