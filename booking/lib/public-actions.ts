'use server';

import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {headers} from 'next/headers';
import {prisma} from './db';
import {normalizePhone} from './phone';
import {rateLimited} from './rate-limit';
import {createBooking, BookingError} from './bookings';

/**
 * Публичный экшен виджета /book (ТЗ §4.1, FR-CLI-4 — заявка от клиента без логина).
 * В отличие от lib/actions.saveBooking, НЕ требует залогиненного сотрудника:
 * создателем брони назначается служебный аккаунт ONLINE_USER_ID. Заявка падает
 * в общий календарь как бронь status=NEW, source=WIDGET — менеджер подтверждает.
 * Анти-овербукинг и валидация — через тот же createBooking (lib/bookings.ts).
 */

// Должен совпадать с ONLINE_USER_ID в prisma/seed.ts (служебный «Онлайн-заявки»).
const ONLINE_USER_ID = 'u-online';

const requestInput = z.object({
  resourceId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(3),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  guests: z.coerce.number().int().positive().max(1000).default(1),
  comment: z.string().trim().max(1000).optional(),
});

export type PublicBookingError =
  | 'INVALID_INPUT'
  | 'OVERLAP'
  | 'MIN_DURATION'
  | 'INVALID_RANGE'
  | 'RESOURCE_NOT_FOUND'
  | 'RATE_LIMITED';

function clientIp(): string {
  const h = headers();
  const fwd = h.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return h.get('x-real-ip') ?? 'unknown';
}

/** Гарантирует существование служебного создателя заявок (на случай без seed). */
async function ensureOnlineUser(): Promise<string> {
  const user = await prisma.user.upsert({
    where: {id: ONLINE_USER_ID},
    update: {},
    create: {
      id: ONLINE_USER_ID,
      name: 'Онлайн-заявки',
      phone: 'online',
      // Случайный непригодный хэш — войти под аккаунтом нельзя (плюс isActive=false).
      passwordHash: '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv',
      role: 'MANAGER',
      isActive: false,
    },
  });
  return user.id;
}

export async function submitBookingRequest(raw: unknown) {
  if (rateLimited(clientIp())) {
    return {ok: false as const, error: 'RATE_LIMITED' as PublicBookingError};
  }
  const parsed = requestInput.safeParse(raw);
  if (!parsed.success) {
    return {ok: false as const, error: 'INVALID_INPUT' as PublicBookingError};
  }
  const data = parsed.data;
  const phone = normalizePhone(data.phone);
  if (!phone) {
    return {ok: false as const, error: 'INVALID_INPUT' as PublicBookingError};
  }

  // Клиент по телефону: переиспользуем существующего, иначе создаём нового.
  let client = await prisma.client.findUnique({where: {phone}});
  if (!client) {
    client = await prisma.client.create({data: {name: data.name, phone}});
  }

  const createdById = await ensureOnlineUser();

  try {
    await createBooking(
      {
        resourceId: data.resourceId,
        clientId: client.id,
        startAt: data.startAt,
        endAt: data.endAt,
        guests: data.guests,
        comment: data.comment,
        status: 'NEW',
        source: 'WIDGET',
        tariff: 'HOURLY',
      },
      createdById,
    );
    // Бронь видна сотрудникам в календаре.
    revalidatePath('/', 'layout');
    return {ok: true as const};
  } catch (e) {
    if (e instanceof BookingError) {
      return {ok: false as const, error: e.code as PublicBookingError, message: e.message};
    }
    throw e;
  }
}
