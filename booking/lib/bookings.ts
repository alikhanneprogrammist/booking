import {z} from 'zod';
import {Prisma} from '@prisma/client';
import {prisma} from './db';
import {durationHours} from './time';
import {computePrice, type PricingResource, type Tariff} from './pricing';
import {getSettings} from './queries';

// ───────────────────────── Ошибки домена ──────────────────────────────

export type BookingErrorCode =
  | 'INVALID_RANGE'
  | 'MIN_DURATION'
  | 'OVERLAP'
  | 'RESOURCE_NOT_FOUND';

export class BookingError extends Error {
  constructor(
    public code: BookingErrorCode,
    message: string,
    public meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'BookingError';
  }
}

/** Перехват нарушения exclusion-constraint booking_no_overlap (ТЗ §4.6, барьер БД). */
function isOverlapDbError(e: unknown): boolean {
  const msg =
    e instanceof Prisma.PrismaClientKnownRequestError ||
    e instanceof Prisma.PrismaClientUnknownRequestError
      ? e.message
      : e instanceof Error
        ? e.message
        : '';
  return (
    msg.includes('booking_no_overlap') ||
    msg.includes('exclusion constraint') ||
    msg.includes('23P01')
  );
}

// ───────────────────────── Валидация (Zod) ─────────────────────────────

const ADDON = z.object({
  addonId: z.string().min(1),
  qty: z.number().int().positive().default(1),
  priceAtBooking: z.number().nonnegative(),
});

export const bookingInput = z.object({
  resourceId: z.string().min(1),
  clientId: z.string().min(1),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  status: z
    .enum(['NEW', 'CONFIRMED', 'PREPAID', 'COMPLETED', 'CANCELLED', 'NO_SHOW'])
    .default('NEW'),
  source: z
    .enum(['ADMIN', 'PHONE', 'WHATSAPP', 'INSTAGRAM', 'WIDGET'])
    .default('ADMIN'),
  tariff: z
    .enum(['HOURLY', 'HALF_DAY', 'FULL_DAY', 'WEEKEND', 'CUSTOM'])
    .default('HOURLY'),
  guests: z.number().int().positive().default(1),
  total: z.number().nonnegative().optional(), // если не задан — авторасчёт
  deposit: z.number().nonnegative().default(0),
  // optional (не default 0): отличаем «не задано» (виджет → подставить %) от явного 0.
  prepayment: z.number().nonnegative().optional(),
  discountType: z.enum(['NONE', 'PERCENT', 'AMOUNT']).default('NONE'),
  discountValue: z.number().nonnegative().default(0),
  comment: z.string().max(2000).optional(),
  addons: z.array(ADDON).default([]),
});

export type BookingInput = z.input<typeof bookingInput>;

// ───────────────────────── Хелперы ────────────────────────────────────

function toPricingResource(r: {
  hourlyPrice: Prisma.Decimal;
  minHours: number;
  halfDayPrice: Prisma.Decimal | null;
  fullDayPrice: Prisma.Decimal | null;
  weekendPrice: Prisma.Decimal | null;
  weekdayMinDeposit: Prisma.Decimal | null;
  capacity: number;
}): PricingResource {
  const n = (d: Prisma.Decimal | null) => (d == null ? null : Number(d));
  return {
    hourlyPrice: Number(r.hourlyPrice),
    minHours: r.minHours,
    halfDayPrice: n(r.halfDayPrice),
    fullDayPrice: n(r.fullDayPrice),
    weekendPrice: n(r.weekendPrice),
    weekdayMinDeposit: n(r.weekdayMinDeposit),
    capacity: r.capacity,
  };
}

/** Барьер приложения (ТЗ §4.6, п.2): ищет активную пересекающуюся бронь. */
export async function findOverlap(
  resourceId: string,
  startAt: Date,
  endAt: Date,
  excludeBookingId?: string,
) {
  return prisma.booking.findFirst({
    where: {
      resourceId,
      id: excludeBookingId ? {not: excludeBookingId} : undefined,
      status: {not: 'CANCELLED'},
      startAt: {lt: endAt}, // полуоткрытые интервалы [start, end)
      endAt: {gt: startAt},
    },
    select: {id: true, startAt: true, endAt: true},
  });
}

/** Общая валидация диапазона и минимальной длительности. */
async function validateRange(
  resource: PricingResource,
  tariff: Tariff,
  startAt: Date,
  endAt: Date,
) {
  if (endAt <= startAt) {
    throw new BookingError('INVALID_RANGE', 'Конец брони должен быть позже начала');
  }
  if (tariff === 'HOURLY') {
    const hours = durationHours(startAt, endAt);
    if (hours < resource.minHours) {
      throw new BookingError(
        'MIN_DURATION',
        `Минимальная длительность брони — ${resource.minHours} ч`,
        {minHours: resource.minHours, hours},
      );
    }
  }
}

// ───────────────────────── CRUD ───────────────────────────────────────

/** Создание брони (ТЗ §4.5): валидация → анти-овербукинг → авторасчёт → транзакция. */
export async function createBooking(raw: BookingInput, createdById: string) {
  const data = bookingInput.parse(raw);

  const resource = await prisma.resource.findUnique({where: {id: data.resourceId}});
  if (!resource) throw new BookingError('RESOURCE_NOT_FOUND', 'Объект не найден');
  const pr = toPricingResource(resource);

  // Глобальное правило: минимум брони — не меньше настройки заведения (поверх объектного).
  const settings = await getSettings();
  pr.minHours = Math.max(pr.minHours, settings.minBookingHours);

  await validateRange(pr, data.tariff, data.startAt, data.endAt);

  // Барьер приложения.
  const conflict = await findOverlap(data.resourceId, data.startAt, data.endAt);
  if (conflict) {
    throw new BookingError('OVERLAP', 'Объект занят в это время', {conflictId: conflict.id});
  }

  const price = computePrice(
    pr,
    data.tariff,
    data.startAt,
    data.endAt,
    data.addons.map((a) => ({price: a.priceAtBooking, qty: a.qty})),
    data.guests,
    {type: data.discountType, value: data.discountValue},
  );

  // Глобальное правило: если предоплата НЕ задана (undefined, напр. из виджета) —
  // подставляем % от суммы. Явный 0 от менеджера сохраняется как есть.
  const total = data.total ?? price.total;
  const prepayment =
    data.prepayment != null
      ? data.prepayment
      : settings.prepaymentPercent > 0
        ? Math.round(total * settings.prepaymentPercent) / 100
        : 0;

  try {
    const booking = await prisma.$transaction((tx) =>
      tx.booking.create({
        data: {
          resourceId: data.resourceId,
          clientId: data.clientId,
          startAt: data.startAt,
          endAt: data.endAt,
          status: data.status,
          source: data.source,
          tariff: data.tariff,
          guests: data.guests,
          total,
          deposit: data.deposit,
          prepayment,
          discountType: data.discountType,
          discountValue: data.discountValue,
          comment: data.comment,
          createdById,
          addons: {
            create: data.addons.map((a) => ({
              addonId: a.addonId,
              qty: a.qty,
              priceAtBooking: a.priceAtBooking,
            })),
          },
        },
        include: {addons: true},
      }),
    );
    return {booking, price};
  } catch (e) {
    // Барьер БД: маппим constraint в то же сообщение (защита от гонок).
    if (isOverlapDbError(e)) {
      throw new BookingError('OVERLAP', 'Объект занят в это время');
    }
    throw e;
  }
}

/** Редактирование / перенос брони (ТЗ §4.5: смена времени и/или объекта). */
export async function updateBooking(id: string, rawInput: Partial<BookingInput>) {
  // Частичная Zod-валидация: заданные поля проходят те же проверки, что и при создании
  // (иначе прямой вызов server action мог бы записать отрицательные суммы и т.п.).
  // ВАЖНО: .partial() всё равно подставляет дефолты (status=NEW, addons=[]) для
  // отсутствующих ключей — оставляем только то, что реально пришло в патче.
  const parsed = bookingInput.partial().parse(rawInput);
  const raw = Object.fromEntries(
    Object.entries(parsed).filter(([k]) => k in rawInput),
  ) as typeof parsed;

  const existing = await prisma.booking.findUnique({where: {id}});
  if (!existing) throw new BookingError('RESOURCE_NOT_FOUND', 'Бронь не найдена');

  const resourceId = raw.resourceId ?? existing.resourceId;
  const startAt = raw.startAt ?? existing.startAt;
  const endAt = raw.endAt ?? existing.endAt;
  const tariff = (raw.tariff ?? existing.tariff) as Tariff;

  const resource = await prisma.resource.findUnique({where: {id: resourceId}});
  if (!resource) throw new BookingError('RESOURCE_NOT_FOUND', 'Объект не найден');
  const pr = toPricingResource(resource);

  const settings = await getSettings();
  pr.minHours = Math.max(pr.minHours, settings.minBookingHours);

  await validateRange(pr, tariff, startAt, endAt);

  const conflict = await findOverlap(resourceId, startAt, endAt, id);
  if (conflict) {
    throw new BookingError('OVERLAP', 'Объект занят в это время', {conflictId: conflict.id});
  }

  // Патч меняет цено-влияющие поля, но не задаёт total → пересчитываем сами,
  // иначе итог молча разойдётся с фактическим составом брони. Явный total уважаем.
  const PRICE_KEYS = [
    'resourceId', 'startAt', 'endAt', 'tariff', 'guests',
    'discountType', 'discountValue', 'addons',
  ] as const;
  let recalcTotal: number | undefined;
  if (!('total' in raw) && PRICE_KEYS.some((k) => k in raw)) {
    const addonLines = raw.addons
      ? raw.addons.map((a) => ({price: a.priceAtBooking, qty: a.qty ?? 1}))
      : (await prisma.bookingAddon.findMany({where: {bookingId: id}})).map((a) => ({
          price: Number(a.priceAtBooking),
          qty: a.qty,
        }));
    const price = computePrice(pr, tariff, startAt, endAt, addonLines, raw.guests ?? existing.guests, {
      type: raw.discountType ?? existing.discountType,
      value: raw.discountValue ?? Number(existing.discountValue),
    });
    recalcTotal = price.total;
  }

  try {
    // Транзакция: при правке состава доп.услуг заменяем строки целиком
    // (deleteMany + create), иначе total разойдётся с фактическими addons.
    return await prisma.$transaction(async (tx) => {
      if (raw.addons !== undefined) {
        await tx.bookingAddon.deleteMany({where: {bookingId: id}});
      }
      return tx.booking.update({
        where: {id},
        data: {
          resourceId,
          startAt,
          endAt,
          tariff,
          ...(raw.clientId ? {clientId: raw.clientId} : {}),
          ...(raw.status ? {status: raw.status} : {}),
          ...(raw.source ? {source: raw.source} : {}),
          ...(raw.guests != null ? {guests: raw.guests} : {}),
          ...(raw.total != null ? {total: raw.total} : recalcTotal != null ? {total: recalcTotal} : {}),
          ...(raw.deposit != null ? {deposit: raw.deposit} : {}),
          ...(raw.prepayment != null ? {prepayment: raw.prepayment} : {}),
          ...(raw.discountType != null ? {discountType: raw.discountType} : {}),
          ...(raw.discountValue != null ? {discountValue: raw.discountValue} : {}),
          ...(raw.comment !== undefined ? {comment: raw.comment} : {}),
          ...(raw.addons !== undefined
            ? {
                addons: {
                  create: raw.addons.map((a) => ({
                    addonId: a.addonId,
                    qty: a.qty ?? 1,
                    priceAtBooking: a.priceAtBooking,
                  })),
                },
              }
            : {}),
        },
      });
    });
  } catch (e) {
    if (isOverlapDbError(e)) throw new BookingError('OVERLAP', 'Объект занят в это время');
    throw e;
  }
}

/** Отмена брони (ТЗ §4.5: статус CANCELLED, освобождает время). */
export async function cancelBooking(id: string) {
  return prisma.booking.update({where: {id}, data: {status: 'CANCELLED'}});
}

