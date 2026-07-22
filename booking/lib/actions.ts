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
import {toClient, toResource, toAddon, toUser} from './queries';
import type {MockResource, MockAddon} from './types';
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

/** Строка импорта гостей (валидируется и на клиенте, и здесь). */
export interface ImportClientInput {
  name: string;
  phone: string;
  note?: string;
  tags?: string[];
  dateOfBirth?: Date;
}

export type ImportClientResult = {
  name: string;
  phone: string;
  ok: boolean;
  error?: 'DUPLICATE_PHONE' | 'INVALID';
};

const CLIENT_IMPORT_MAX_ROWS = 500; // защитный потолок на один импорт

/** Импорт гостей из Excel/CSV (разбор файла — на клиенте, lib/import-clients). */
export async function importClients(rows: ImportClientInput[]) {
  if (!(await currentUser())) return {ok: false as const, error: 'FORBIDDEN' as const};
  const results: ImportClientResult[] = [];

  for (const r of rows.slice(0, CLIENT_IMPORT_MAX_ROWS)) {
    const name = (r.name ?? '').trim();
    const phone = normalizePhone(r.phone ?? '');
    // Серверная перепроверка: клиенту доверять нельзя.
    if (!name || !/^\+\d{10,15}$/.test(phone)) {
      results.push({name, phone, ok: false, error: 'INVALID'});
      continue;
    }
    try {
      await prisma.client.create({
        data: {
          name,
          phone,
          note: r.note?.trim() || null,
          tags: (r.tags ?? []).map((t) => String(t).trim()).filter(Boolean),
          dateOfBirth: r.dateOfBirth ?? null,
        },
      });
      results.push({name, phone, ok: true});
    } catch (e) {
      if (isUniquePhone(e)) results.push({name, phone, ok: false, error: 'DUPLICATE_PHONE'});
      else throw e;
    }
  }

  refresh();
  return {ok: true as const, results};
}

export async function saveClient(input: {
  id?: string; name: string; phone: string; note?: string; tags?: string[]; dateOfBirth?: Date;
}) {
  if (!(await currentUser())) return {ok: false as const, error: 'FORBIDDEN' as const};
  const phone = normalizePhone(input.phone);
  const data = {
    name: input.name, phone, note: input.note ?? null, tags: input.tags ?? [],
    dateOfBirth: input.dateOfBirth ?? null,
  };
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
      await updateBooking(input.id, input, user.id);
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
  const user = await currentUser();
  if (!user) return {ok: false as const, error: 'FORBIDDEN' as const};
  await cancelBooking(id, user.id);
  refresh();
  return {ok: true as const};
}

/** История изменений брони (журнал аудита) — для диалога. Любой сотрудник. */
export async function getBookingHistory(bookingId: string) {
  if (!(await currentUser())) return {ok: false as const, error: 'FORBIDDEN' as const};
  const rows = await prisma.bookingAudit.findMany({
    where: {bookingId},
    orderBy: {createdAt: 'desc'},
    include: {user: {select: {name: true}}},
  });
  return {
    ok: true as const,
    entries: rows.map((r) => ({
      id: r.id,
      action: r.action,
      userName: r.user.name,
      at: r.createdAt,
      changes: (r.changes as {field: string; from: unknown; to: unknown}[] | null) ?? [],
    })),
  };
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

/** Минимальная длина задаваемого вручную пароля. */
const MIN_PASSWORD = 6;

export async function saveUser(input: {
  id?: string; name: string; phone: string; email?: string;
  role: 'ADMIN' | 'MANAGER'; isActive: boolean; password?: string;
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
      // Пароль: заданный админом (если валиден) либо авто-временный.
      const chosen = (input.password ?? '').trim();
      if (chosen && chosen.length < MIN_PASSWORD) {
        return {ok: false as const, error: 'WEAK_PASSWORD' as const};
      }
      const password = chosen || `OFF-${randomUUID().slice(0, 8)}`;
      const passwordHash = await bcrypt.hash(password, 10);
      u = await prisma.user.create({data: {...base, passwordHash}});
      refresh();
      // tempPassword показываем админу только если сгенерировали сами.
      return {ok: true as const, user: toUser(u), tempPassword: chosen ? undefined : password};
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

/** Строка импорта сотрудников (валидируется и на клиенте, и здесь). */
export interface ImportUserInput {
  name: string;
  phone: string;
  email?: string;
  role: 'ADMIN' | 'MANAGER';
  password?: string;
}

export type ImportUserResult = {
  name: string;
  phone: string;
  ok: boolean;
  tempPassword?: string; // выдан, если пароль не задан в файле
  error?: 'DUPLICATE_PHONE' | 'INVALID';
};

const IMPORT_MAX_ROWS = 200; // защитный потолок на один импорт

/** Импорт сотрудников из Excel/CSV (разбор файла — на клиенте, lib/import-users). */
export async function importUsers(rows: ImportUserInput[]) {
  await requireAdmin();
  const results: ImportUserResult[] = [];

  for (const r of rows.slice(0, IMPORT_MAX_ROWS)) {
    const name = (r.name ?? '').trim();
    const phone = normalizePhone(r.phone ?? '');
    const chosen = (r.password ?? '').trim();
    // Серверная перепроверка: клиенту доверять нельзя (экшен вызывается по id глобально).
    if (!name || !/^\+\d{10,15}$/.test(phone) || (chosen !== '' && chosen.length < MIN_PASSWORD)) {
      results.push({name, phone, ok: false, error: 'INVALID'});
      continue;
    }
    const password = chosen || `OFF-${randomUUID().slice(0, 8)}`;
    const passwordHash = await bcrypt.hash(password, 10);
    try {
      await prisma.user.create({
        data: {
          name,
          phone,
          email: r.email?.trim() || null,
          role: r.role === 'ADMIN' ? 'ADMIN' : 'MANAGER',
          isActive: true,
          passwordHash,
        },
      });
      results.push({name, phone, ok: true, tempPassword: chosen ? undefined : password});
    } catch (e) {
      if (isUniquePhone(e)) results.push({name, phone, ok: false, error: 'DUPLICATE_PHONE'});
      else throw e;
    }
  }

  refresh();
  return {ok: true as const, results};
}

/** FR-USER-3: сброс пароля — админ задаёт новый пароль вручную. */
export async function resetPasswordAction(id: string, newPassword: string) {
  await requireAdmin();
  const password = (newPassword ?? '').trim();
  if (password.length < MIN_PASSWORD) return {ok: false as const, error: 'WEAK_PASSWORD' as const};
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({where: {id}, data: {passwordHash}});
  return {ok: true as const};
}

// ───────────────────────── Настройки заведения — ADMIN ─────────────────

/** Пустую строку храним как NULL — тогда getSettings отдаёт i18n-дефолт. */
const orNull = (s: string | undefined) => {
  const v = (s ?? '').trim();
  return v === '' ? null : v;
};

/** Строковые поля с общей '' → NULL логикой (см. orNull). */
const SETTINGS_STR_KEYS = [
  'phone', 'whatsapp', 'instagram', 'email', 'address', 'requisites',
  'publicTitleRu', 'publicTitleKk', 'publicSubtitleRu', 'publicSubtitleKk',
  'publicInfoRu', 'publicInfoKk', 'publicContacts',
] as const;

/**
 * Частичное сохранение: пишутся ТОЛЬКО присутствующие в input ключи.
 * Вкладки «Заведение» и «Публичная страница» шлют каждая своё подмножество
 * и не затирают поля друг друга (раньше последняя сохранённая побеждала).
 */
export async function saveSettings(input: Partial<AppSettings>) {
  await requireAdmin();
  const clamp = (n: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, Math.round(Number.isFinite(n) ? n : lo)));

  const data: Record<string, string | number | null> = {};
  if ('companyName' in input) data.companyName = (input.companyName ?? '').trim() || 'OFFICE 2020';
  // data-URL логотипа: серверная валидация (клиентский лимит обходится прямым вызовом).
  // Разрешаем только растровые image data-URL (без svg — он может нести скрипты), ≤600КБ.
  if ('logoUrl' in input) {
    const v = input.logoUrl ?? '';
    if (v === '') {
      data.logoUrl = null;
    } else if (/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= 600_000) {
      data.logoUrl = v;
    } else {
      return {ok: false as const, error: 'INVALID_LOGO' as const};
    }
  }
  if ('minBookingHours' in input) data.minBookingHours = clamp(input.minBookingHours ?? 3, 1, 24);
  if ('prepaymentPercent' in input) data.prepaymentPercent = clamp(input.prepaymentPercent ?? 0, 0, 100);
  for (const k of SETTINGS_STR_KEYS) {
    if (k in input) data[k] = orNull(input[k]);
  }

  // Все поля модели имеют default/nullable — create с частичным data валиден.
  await prisma.settings.upsert({
    where: {id: SETTINGS_ID},
    update: data,
    create: {id: SETTINGS_ID, ...data},
  });
  refresh();
  return {ok: true as const};
}

// ───────────────────────── Журнал предоплат (ручной ввод) ──────────────
// Строки пишутся в PrepaymentArchive: видны только во вкладке «Предоплаты»,
// в аналитику/клиентов/календарь не попадают (подтверждённое требование).

const PREPAY_METHODS = ['KASPI', 'CASH', 'BANK'] as const;

export interface ArchivePrepaymentInput {
  amount: number;
  guest: string;
  resourceLabel: string;
  paidAt: Date;
  visitAt: Date;
  paymentMethod?: string | null;
  note?: string;
}

/** Ручная строка журнала предоплат — доступно всем сотрудникам. */
export async function addArchivePrepayment(input: ArchivePrepaymentInput) {
  const user = await currentUser();
  if (!user) return {ok: false as const, error: 'FORBIDDEN' as const};

  const amount = Math.round(Number(input.amount));
  const guest = (input.guest ?? '').trim();
  const resourceLabel = (input.resourceLabel ?? '').trim();
  const paidAt = new Date(input.paidAt);
  const visitAt = new Date(input.visitAt);
  if (
    !Number.isFinite(amount) || amount <= 0 || !guest || !resourceLabel ||
    Number.isNaN(paidAt.getTime()) || Number.isNaN(visitAt.getTime())
  ) {
    return {ok: false as const, error: 'INVALID' as const};
  }

  await prisma.prepaymentArchive.create({
    data: {
      amount,
      guest,
      resourceLabel,
      paidAt,
      visitAt,
      paymentMethod: PREPAY_METHODS.find((m) => m === input.paymentMethod) ?? null,
      note: (input.note ?? '').trim() || null,
      manager: user.name ?? null, // ответственный — кто внёс
    },
  });
  refresh();
  return {ok: true as const};
}

/** Удаление ошибочной строки журнала — только ADMIN. */
export async function removeArchivePrepayment(id: string) {
  await requireAdmin();
  await prisma.prepaymentArchive.delete({where: {id}});
  refresh();
  return {ok: true as const};
}

// ───────────────────────── Журнал внутренней доставки ──────────────────
// Строки пишутся в DeliveryOrder: видны только во вкладке «Доставка»,
// в аналитику/клиентов/календарь не попадают. Менеджеры добавляют и правят,
// удаление — только ADMIN (как в журнале предоплат).

export interface DeliveryOrderInput {
  date: Date;
  amount: number;
  courierCost?: number | null;
  address?: string;
  phone?: string;
  promo?: string;
  note?: string;
}

// Общая проверка полей заказа доставки; null — данные некорректны.
function parseDeliveryInput(input: DeliveryOrderInput) {
  const amount = Math.round(Number(input.amount));
  const date = new Date(input.date);
  const courierCost =
    input.courierCost === null || input.courierCost === undefined
      ? null
      : Math.round(Number(input.courierCost));
  if (
    !Number.isFinite(amount) || amount <= 0 || Number.isNaN(date.getTime()) ||
    (courierCost !== null && (!Number.isFinite(courierCost) || courierCost < 0))
  ) {
    return null;
  }
  return {
    date,
    amount,
    courierCost,
    address: (input.address ?? '').trim() || null,
    phone: (input.phone ?? '').trim() || null,
    promo: (input.promo ?? '').trim() || null,
    note: (input.note ?? '').trim() || null,
  };
}

/** Ручная строка журнала доставки — доступно всем сотрудникам. */
export async function addDeliveryOrder(input: DeliveryOrderInput) {
  const user = await currentUser();
  if (!user) return {ok: false as const, error: 'FORBIDDEN' as const};

  const data = parseDeliveryInput(input);
  if (!data) return {ok: false as const, error: 'INVALID' as const};

  await prisma.deliveryOrder.create({
    data: {...data, manager: user.name ?? null}, // ответственный — кто внёс
  });
  refresh();
  return {ok: true as const};
}

/** Правка строки журнала доставки — доступно всем сотрудникам. */
export async function updateDeliveryOrder(id: string, input: DeliveryOrderInput) {
  const user = await currentUser();
  if (!user) return {ok: false as const, error: 'FORBIDDEN' as const};

  const data = parseDeliveryInput(input);
  if (!data) return {ok: false as const, error: 'INVALID' as const};

  const existing = await prisma.deliveryOrder.findUnique({where: {id}, select: {id: true}});
  if (!existing) return {ok: false as const, error: 'NOT_FOUND' as const};

  await prisma.deliveryOrder.update({where: {id}, data}); // manager не трогаем — остаётся автор
  refresh();
  return {ok: true as const};
}

/** Удаление ошибочной строки журнала доставки — только ADMIN. */
export async function removeDeliveryOrder(id: string) {
  await requireAdmin();
  await prisma.deliveryOrder.delete({where: {id}});
  refresh();
  return {ok: true as const};
}

/**
 * Убрать предоплату из брони (строка журнала «Предоплаты» из брони) — только ADMIN.
 * Бронь остаётся, обнуляются prepayment/prepaidAt (строка уходит и из аналитики);
 * изменение пишется в журнал аудита брони.
 */
export async function clearBookingPrepayment(id: string) {
  const user = await requireAdmin();
  const b = await prisma.booking.findUnique({where: {id}, select: {prepayment: true}});
  if (!b) return {ok: false as const, error: 'NOT_FOUND' as const};
  await prisma.$transaction([
    prisma.booking.update({where: {id}, data: {prepayment: 0, prepaidAt: null}}),
    prisma.bookingAudit.create({
      data: {
        bookingId: id,
        userId: user.id!,
        action: 'UPDATE',
        changes: [{field: 'prepayment', from: Number(b.prepayment), to: 0}],
      },
    }),
  ]);
  refresh();
  return {ok: true as const};
}
