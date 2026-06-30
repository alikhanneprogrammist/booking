'use server';

import {revalidatePath} from 'next/cache';
import {randomUUID} from 'crypto';
import bcrypt from 'bcryptjs';
import {Prisma} from '@prisma/client';
import {prisma} from './db';
import {normalizePhone} from './phone';
import {currentUser, requireAdmin} from './auth-helpers';
import {
  createBooking, updateBooking, cancelBooking, BookingError, type BookingInput,
} from './bookings';
import {toClient, toResource, toAddon, toUser, toWaiter} from './queries';
import type {MockResource, MockAddon} from './mock-data';
import {SETTINGS_ID, type AppSettings} from './settings';

/**
 * Серверные экшены (этап 2): мутации поверх Prisma. Ожидаемые доменные ошибки
 * возвращаются как {ok:false, error}, чтобы клиент показал понятный текст
 * (а не падал на санитизированном проде). После успеха — revalidatePath,
 * клиент дополнительно делает router.refresh().
 */

function refresh() {
  revalidatePath('/', 'layout');
}

function isUniquePhone(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

// ───────────────────────── Клиенты (ТЗ §4.3) ──────────────────────────

export async function saveClient(input: {
  id?: string; name: string; phone: string; note?: string; tags?: string[];
}) {
  if (!(await currentUser())) return {ok: false as const, error: 'FORBIDDEN' as const};
  const phone = normalizePhone(input.phone);
  const data = {name: input.name, phone, note: input.note ?? null, tags: input.tags ?? []};
  try {
    const c = input.id
      ? await prisma.client.update({where: {id: input.id}, data})
      : await prisma.client.create({data});
    refresh();
    return {ok: true as const, client: toClient(c)};
  } catch (e) {
    if (isUniquePhone(e)) return {ok: false as const, error: 'DUPLICATE_PHONE' as const};
    throw e;
  }
}

export async function removeClient(id: string) {
  if (!(await currentUser())) return {ok: false as const, error: 'FORBIDDEN' as const};
  try {
    await prisma.client.delete({where: {id}});
    refresh();
    return {ok: true as const};
  } catch (e) {
    // FK RESTRICT: у клиента есть брони.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      return {ok: false as const, error: 'CLIENT_IN_USE' as const};
    }
    throw e;
  }
}

// ───────────────────────── Брони (ТЗ §4.5) ────────────────────────────

export async function saveBooking(input: BookingInput & {id?: string}) {
  const user = await currentUser();
  if (!user) return {ok: false as const, error: 'FORBIDDEN' as const};
  try {
    if (input.id) {
      await updateBooking(input.id, input);
    } else {
      await createBooking(input, user.id);
    }
    refresh();
    return {ok: true as const};
  } catch (e) {
    if (e instanceof BookingError) {
      return {ok: false as const, error: e.code, message: e.message};
    }
    throw e;
  }
}

export async function cancelBookingAction(id: string) {
  if (!(await currentUser())) return {ok: false as const, error: 'FORBIDDEN' as const};
  await cancelBooking(id);
  refresh();
  return {ok: true as const};
}

// ───────────────────────── Объекты (ТЗ §4.2 FR-RES) — ADMIN ────────────

type ResourceInput = Omit<MockResource, 'id'> & {id?: string};

export async function saveResource(input: ResourceInput) {
  await requireAdmin();
  const {id, ...rest} = input;
  const data = {
    kind: rest.kind,
    nameRu: rest.nameRu,
    nameKk: rest.nameKk,
    capacity: rest.capacity,
    color: rest.color,
    photos: rest.photos,
    isActive: rest.isActive,
    sortOrder: rest.sortOrder,
    floors: rest.floors,
    hasKaraoke: rest.hasKaraoke,
    hasFinnishSauna: rest.hasFinnishSauna,
    hasHammam: rest.hasHammam,
    hasPool: rest.hasPool,
    hasBanquet: rest.hasBanquet,
    restRooms: rest.restRooms,
    hasKitchen: rest.hasKitchen,
    hourlyPrice: rest.hourlyPrice,
    minHours: rest.minHours,
    halfDayPrice: rest.halfDayPrice,
    fullDayPrice: rest.fullDayPrice,
    weekendPrice: rest.weekendPrice,
    weekdayMinDeposit: rest.weekdayMinDeposit,
    priceNote: rest.priceNote ?? null,
  };
  const r = id
    ? await prisma.resource.update({where: {id}, data})
    : await prisma.resource.create({data});
  refresh();
  return {ok: true as const, resource: toResource(r)};
}

export async function setResourceActiveAction(id: string, isActive: boolean) {
  await requireAdmin();
  await prisma.resource.update({where: {id}, data: {isActive}});
  refresh();
  return {ok: true as const};
}

export async function removeResource(id: string) {
  await requireAdmin();
  // FR-RES-5: удалять нельзя при наличии броней — только деактивировать.
  const used = await prisma.booking.count({where: {resourceId: id}});
  if (used > 0) return {ok: false as const, error: 'RESOURCE_IN_USE' as const};
  await prisma.resource.delete({where: {id}});
  refresh();
  return {ok: true as const};
}

// ───────────────────────── Доп.услуги (FR-RES-4) ──────────────────────

type AddonInput = Omit<MockAddon, 'id'> & {id?: string};

export async function saveAddon(input: AddonInput) {
  await requireAdmin();
  const {id, ...rest} = input;
  const a = id
    ? await prisma.serviceAddon.update({where: {id}, data: rest})
    : await prisma.serviceAddon.create({data: rest});
  refresh();
  return {ok: true as const, addon: toAddon(a)};
}

export async function removeAddon(id: string) {
  await requireAdmin();
  try {
    await prisma.serviceAddon.delete({where: {id}});
    refresh();
    return {ok: true as const};
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      return {ok: false as const, error: 'ADDON_IN_USE' as const};
    }
    throw e;
  }
}

// ───────────────────────── Сотрудники (ТЗ §4.7 FR-USER) — ADMIN ────────

export async function saveUser(input: {
  id?: string; name: string; phone: string; email?: string;
  role: 'ADMIN' | 'MANAGER'; isActive: boolean;
}) {
  await requireAdmin();
  const phone = normalizePhone(input.phone);
  const base = {
    name: input.name, phone, email: input.email ?? null,
    role: input.role, isActive: input.isActive,
  };
  try {
    let u;
    if (input.id) {
      u = await prisma.user.update({where: {id: input.id}, data: base});
    } else {
      // Новому сотруднику нужен пароль — выдаём временный (меняется при первом входе).
      const tempPassword = `OFF-${randomUUID().slice(0, 8)}`;
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      u = await prisma.user.create({data: {...base, passwordHash}});
      refresh();
      return {ok: true as const, user: toUser(u), tempPassword};
    }
    refresh();
    return {ok: true as const, user: toUser(u)};
  } catch (e) {
    if (isUniquePhone(e)) return {ok: false as const, error: 'DUPLICATE_PHONE' as const};
    throw e;
  }
}

export async function setUserActiveAction(id: string, isActive: boolean) {
  await requireAdmin();
  await prisma.user.update({where: {id}, data: {isActive}});
  refresh();
  return {ok: true as const};
}

/** FR-USER-3: сброс пароля — генерирует временный, хэширует, возвращает открытый. */
export async function resetPasswordAction(id: string) {
  await requireAdmin();
  const tempPassword = `OFF-${randomUUID().slice(0, 8)}`;
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  await prisma.user.update({where: {id}, data: {passwordHash}});
  return {ok: true as const, tempPassword};
}

// ───────────────────────── Официанты (справочник) — ADMIN ─────────────

export async function saveWaiter(input: {
  id?: string; name: string; isActive: boolean; sortOrder: number;
}) {
  await requireAdmin();
  // Валидация на сервере (клиентский disabled — не барьер): имя обязательно, разумная длина.
  const name = (input.name ?? '').trim();
  if (name.length < 1 || name.length > 100) {
    return {ok: false as const, error: 'INVALID_NAME' as const};
  }
  const data = {
    name,
    isActive: input.isActive,
    sortOrder: Number.isFinite(input.sortOrder) ? Math.round(input.sortOrder) : 0,
  };
  const w = input.id
    ? await prisma.waiter.update({where: {id: input.id}, data})
    : await prisma.waiter.create({data});
  refresh();
  return {ok: true as const, waiter: toWaiter(w)};
}

export async function setWaiterActiveAction(id: string, isActive: boolean) {
  await requireAdmin();
  await prisma.waiter.update({where: {id}, data: {isActive}});
  refresh();
  return {ok: true as const};
}

export async function removeWaiter(id: string) {
  await requireAdmin();
  // Нельзя удалять официанта, если он закреплён за бронями — только деактивировать
  // (иначе потеряем имя в истории). Аналогично объектам (FR-RES-5).
  const used = await prisma.booking.count({where: {waiterId: id}});
  if (used > 0) return {ok: false as const, error: 'WAITER_IN_USE' as const};
  await prisma.waiter.delete({where: {id}});
  refresh();
  return {ok: true as const};
}

// ───────────────────────── Настройки заведения — ADMIN ─────────────────

/** Пустую строку храним как NULL — тогда getSettings отдаёт i18n-дефолт. */
const orNull = (s: string | undefined) => {
  const v = (s ?? '').trim();
  return v === '' ? null : v;
};

export async function saveSettings(input: AppSettings) {
  await requireAdmin();
  // data-URL логотипа не триммим (длинная строка); '' → NULL.
  const logoUrl = (input.logoUrl ?? '') === '' ? null : input.logoUrl;
  const clamp = (n: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, Math.round(Number.isFinite(n) ? n : lo)));
  const data = {
    companyName: (input.companyName ?? '').trim() || 'OFFICE 2020',
    logoUrl,
    minBookingHours: clamp(input.minBookingHours, 1, 24),
    prepaymentPercent: clamp(input.prepaymentPercent, 0, 100),
    phone: orNull(input.phone),
    whatsapp: orNull(input.whatsapp),
    instagram: orNull(input.instagram),
    email: orNull(input.email),
    address: orNull(input.address),
    requisites: orNull(input.requisites),
    publicTitleRu: orNull(input.publicTitleRu),
    publicTitleKk: orNull(input.publicTitleKk),
    publicSubtitleRu: orNull(input.publicSubtitleRu),
    publicSubtitleKk: orNull(input.publicSubtitleKk),
    publicInfoRu: orNull(input.publicInfoRu),
    publicInfoKk: orNull(input.publicInfoKk),
    publicContacts: orNull(input.publicContacts),
  };
  await prisma.settings.upsert({
    where: {id: SETTINGS_ID},
    update: data,
    create: {id: SETTINGS_ID, ...data},
  });
  refresh();
  return {ok: true as const};
}
