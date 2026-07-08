import {fromAlmaty, toAlmaty} from './time';
import type {MockResource, MockAddon, MockClient, MockUser, MockBooking} from './types';

// Демо-данные для prisma/seed.ts (реальные 5 объектов из ТЗ §5.8 + демо-брони).
// DTO-типы приложения живут в lib/types.ts, enum-значения — в lib/enums.ts.

// Брони привязаны к дате запуска seed'а (offset в днях от «сегодня» по Алматы),
// чтобы календарь после сидинга всегда показывал живые данные.
const TODAY_WALL = toAlmaty(new Date());

/** Стеночное время Almaty (offset дней от сегодня) → инстант. */
const day = (offset: number, h: number, min = 0) => {
  const wall = new Date(TODAY_WALL);
  wall.setDate(wall.getDate() + offset);
  wall.setHours(h, min, 0, 0);
  return fromAlmaty(wall);
};

// ───────────────────────── Объекты (ТЗ §5.8) ──────────────────────────

export const MOCK_RESOURCES: MockResource[] = [
  {
    id: 'r-7vip', kind: 'COMPLEX', nameRu: '7 VIP', nameKk: '7 VIP', capacity: 22,
    color: '#6366f1', photos: [], isActive: true, sortOrder: 1,
    floors: ['1 этаж: хаммам + фин. сауна + бассейн', '2 этаж: банкет + караоке AST', '3 этаж: 3 комнаты отдыха'],
    hasKaraoke: true, hasFinnishSauna: true, hasHammam: true, hasPool: true, hasBanquet: true,
    restRooms: 3, hasKitchen: true,
    hourlyPrice: 35000, minHours: 3, halfDayPrice: 150000, fullDayPrice: 300000,
    weekendPrice: 300000, weekdayMinDeposit: null, priceNote: 'выходные от 300 000',
  },
  {
    id: 'r-25vip', kind: 'COMPLEX', nameRu: '2/5 VIP', nameKk: '2/5 VIP', capacity: 12,
    color: '#0ea5e9', photos: [], isActive: true, sortOrder: 2,
    floors: ['1 этаж: фин. сауна + хаммам', '2 этаж: банкет + караоке', '3 этаж: 2 комнаты отдыха'],
    hasKaraoke: true, hasFinnishSauna: true, hasHammam: true, hasPool: false, hasBanquet: true,
    restRooms: 2, hasKitchen: true,
    hourlyPrice: 25000, minHours: 3, halfDayPrice: 90000, fullDayPrice: 180000,
    weekendPrice: 200000, weekdayMinDeposit: 50000,
  },
  {
    id: 'r-34vip', kind: 'COMPLEX', nameRu: '3/4 VIP', nameKk: '3/4 VIP', capacity: 12,
    color: '#10b981', photos: [], isActive: true, sortOrder: 3,
    floors: ['1 этаж: фин. сауна + бассейн', '2 этаж: банкет + караоке', '3 этаж: 2 комнаты отдыха'],
    hasKaraoke: true, hasFinnishSauna: true, hasHammam: false, hasPool: true, hasBanquet: true,
    restRooms: 2, hasKitchen: true,
    hourlyPrice: 25000, minHours: 3, halfDayPrice: 90000, fullDayPrice: 180000,
    weekendPrice: 200000, weekdayMinDeposit: 50000,
  },
  {
    id: 'r-6vip', kind: 'KARAOKE', nameRu: '6 VIP', nameKk: '6 VIP', capacity: 15,
    color: '#f59e0b', photos: [], isActive: true, sortOrder: 4,
    floors: ['Караоке AST, отдельный вход, зона курения'],
    hasKaraoke: true, hasFinnishSauna: false, hasHammam: false, hasPool: false, hasBanquet: false,
    restRooms: 0, hasKitchen: false,
    hourlyPrice: 10000, minHours: 3, halfDayPrice: null, fullDayPrice: null,
    weekendPrice: 100000, weekdayMinDeposit: 50000, priceNote: 'депозит',
  },
  {
    id: 'r-banquet', kind: 'KARAOKE', nameRu: 'Банкетный', nameKk: 'Банкеттік', capacity: 45,
    color: '#ec4899', photos: [], isActive: true, sortOrder: 5,
    floors: ['2 этажа: банкет + караоке AST, лаунж, зона курения'],
    hasKaraoke: true, hasFinnishSauna: false, hasHammam: false, hasPool: false, hasBanquet: true,
    restRooms: 0, hasKitchen: true,
    hourlyPrice: 10000, minHours: 3, halfDayPrice: null, fullDayPrice: null,
    weekendPrice: 300000, weekdayMinDeposit: 200000, priceNote: 'депозит',
  },
];

// ───────────────────────── Доп.услуги (ТЗ §5.8) ───────────────────────

export const MOCK_ADDONS: MockAddon[] = [
  {id: 'a-vocal', nameRu: 'Бэк-вокал', nameKk: 'Бэк-вокал', price: 30000, unit: 'PER_EVENT'},
  {id: 'a-belly', nameRu: 'Танец живота', nameKk: 'Іш биі', price: 25000, unit: 'PER_ITEM'},
  {id: 'a-gogo', nameRu: 'Go-go', nameKk: 'Go-go', price: 25000, unit: 'PER_ITEM'},
  {id: 'a-hookah', nameRu: 'Кальян', nameKk: 'Кальян', price: 15000, unit: 'PER_ITEM'},
  {id: 'a-spa', nameRu: 'СПА-процедуры', nameKk: 'СПА-рәсімдер', price: 20000, unit: 'PER_ITEM'},
  {id: 'a-music', nameRu: 'Музоборудование', nameKk: 'Муз. жабдық', price: 20000, unit: 'PER_EVENT'},
];

// ───────────────────────── Сотрудники (ТЗ §5.8) ───────────────────────

export const MOCK_USERS: MockUser[] = [
  {id: 'u-admin', name: 'Администратор', phone: '+77010000001', email: 'admin@office2020.kz', role: 'ADMIN', isActive: true},
  {id: 'u-m1', name: 'Айдана (смена 1)', phone: '+77010000002', role: 'MANAGER', isActive: true},
  {id: 'u-m2', name: 'Бекзат (смена 2)', phone: '+77010000003', role: 'MANAGER', isActive: true},
  {id: 'u-m3', name: 'Гульнара (смена 3)', phone: '+77010000004', role: 'MANAGER', isActive: false},
];

// ───────────────────────── Клиенты ────────────────────────────────────

// ДР хранятся как UTC-полночь (календарная дата). new Date(Date.UTC(y,m0,d)).
export const MOCK_CLIENTS: MockClient[] = [
  {id: 'c-1', name: 'Алихан Серіков', phone: '+77011234567', tags: ['VIP', 'постоянный'], dateOfBirth: new Date(Date.UTC(1990, 2, 15))},
  {id: 'c-2', name: 'Дмитрий Ким', phone: '+77019876543', dateOfBirth: new Date(Date.UTC(1988, 6, 3))},
  {id: 'c-3', name: 'Айгерім Нур', phone: '+77017778899', dateOfBirth: new Date(Date.UTC(1995, 10, 22))},
  {id: 'c-4', name: 'Санжар Ахметов', phone: '+77021112233', note: 'Просит второй этаж'},
  {id: 'c-5', name: 'Мария Ли', phone: '+77055556677', tags: ['блогер'], dateOfBirth: new Date(Date.UTC(1997, 4, 9))},
  {id: 'c-6', name: 'Ерлан Досжанов', phone: '+77770001122', note: 'ТОО «QazTrade» — корпоративы', tags: ['B2B']},
  {id: 'c-7', name: 'Жанна Абишева', phone: '+77081234500'},
  {id: 'c-8', name: 'Тимур Бекетов', phone: '+77473217654', dateOfBirth: new Date(Date.UTC(1992, 0, 30))},
];

// ───────────────────────── Демо-брони (относительно сегодня) ───────────
// Прошлая неделя — завершённые/отменённые, сегодня — активные, впереди —
// новые/подтверждённые. Интервалы внутри одного объекта не пересекаются
// (exclusion constraint booking_no_overlap).

export const MOCK_BOOKINGS: MockBooking[] = [
  // ── 7 VIP (35 000 ₸/ч) ──
  {
    id: 'b-1', resourceId: 'r-7vip', clientId: 'c-1',
    startAt: day(-3, 18), endAt: day(-3, 23),
    status: 'COMPLETED', source: 'PHONE', tariff: 'HOURLY', guests: 20,
    total: 175000, deposit: 0, prepayment: 0, paymentMethod: 'CASH',
    discountType: 'NONE', discountValue: 0, comment: 'Постоянный гость',
    addons: [],
  },
  {
    id: 'b-2', resourceId: 'r-7vip', clientId: 'c-4',
    startAt: day(-1, 22), endAt: day(0, 2), // через полночь
    status: 'COMPLETED', source: 'INSTAGRAM', tariff: 'HOURLY', guests: 14,
    total: 140000, deposit: 0, prepayment: 50000, paymentMethod: 'KASPI',
    discountType: 'NONE', discountValue: 0,
    addons: [{addonId: 'a-hookah', qty: 2, priceAtBooking: 15000}],
  },
  {
    id: 'b-3', resourceId: 'r-7vip', clientId: 'c-2',
    startAt: day(0, 20), endAt: day(1, 0), // сегодня вечером, через полночь
    status: 'CONFIRMED', source: 'WHATSAPP', tariff: 'HOURLY', guests: 18,
    total: 140000, deposit: 0, prepayment: 50000, paymentMethod: 'KASPI',
    discountType: 'NONE', discountValue: 0, comment: 'День рождения',
    addons: [{addonId: 'a-hookah', qty: 2, priceAtBooking: 15000}],
  },
  {
    id: 'b-4', resourceId: 'r-7vip', clientId: 'c-6',
    startAt: day(1, 16), endAt: day(1, 22),
    status: 'PREPAID', source: 'B2B', tariff: 'HOURLY', guests: 22,
    total: 210000, deposit: 0, prepayment: 100000, paymentMethod: 'BANK',
    discountType: 'NONE', discountValue: 0, comment: 'Корпоратив QazTrade',
    addons: [{addonId: 'a-music', qty: 1, priceAtBooking: 20000}],
  },
  {
    id: 'b-5', resourceId: 'r-7vip', clientId: 'c-5',
    startAt: day(3, 12), endAt: day(4, 12), // сутки
    status: 'PREPAID', source: 'GOOGLE_SITE', tariff: 'FULL_DAY', guests: 16,
    total: 300000, deposit: 0, prepayment: 150000, paymentMethod: 'BANK',
    discountType: 'NONE', discountValue: 0,
    addons: [],
  },

  // ── 2/5 VIP (25 000 ₸/ч) ──
  {
    id: 'b-6', resourceId: 'r-25vip', clientId: 'c-7',
    startAt: day(-2, 14), endAt: day(-2, 18),
    status: 'NO_SHOW', source: 'PHONE', tariff: 'HOURLY', guests: 8,
    total: 100000, deposit: 50000, prepayment: 0,
    discountType: 'NONE', discountValue: 0, comment: 'Не пришли, перенос',
    addons: [],
  },
  {
    id: 'b-7', resourceId: 'r-25vip', clientId: 'c-3',
    startAt: day(0, 14), endAt: day(0, 18), // сегодня днём
    status: 'ARRIVED', source: 'WHATSAPP', tariff: 'HOURLY', guests: 10,
    total: 100000, deposit: 50000, prepayment: 50000, paymentMethod: 'KASPI',
    discountType: 'NONE', discountValue: 0,
    addons: [{addonId: 'a-spa', qty: 2, priceAtBooking: 20000}],
  },
  {
    id: 'b-8', resourceId: 'r-25vip', clientId: 'c-8',
    startAt: day(1, 19), endAt: day(1, 23),
    status: 'NEW', source: 'TWO_GIS', tariff: 'HOURLY', guests: 12,
    total: 100000, deposit: 50000, prepayment: 0,
    discountType: 'NONE', discountValue: 0,
    addons: [],
  },
  {
    id: 'b-9', resourceId: 'r-25vip', clientId: 'c-2',
    startAt: day(4, 18), endAt: day(4, 22),
    status: 'CONFIRMED', source: 'RETURNING', tariff: 'HOURLY', guests: 9,
    total: 100000, deposit: 50000, prepayment: 0,
    discountType: 'NONE', discountValue: 0,
    addons: [],
  },

  // ── 3/4 VIP (25 000 ₸/ч) ──
  {
    id: 'b-10', resourceId: 'r-34vip', clientId: 'c-6',
    startAt: day(-4, 12), endAt: day(-3, 12), // сутки
    status: 'COMPLETED', source: 'B2B', tariff: 'FULL_DAY', guests: 12,
    total: 180000, deposit: 0, prepayment: 90000, paymentMethod: 'BANK',
    discountType: 'NONE', discountValue: 0, comment: 'Тимбилдинг',
    addons: [],
  },
  {
    id: 'b-11', resourceId: 'r-34vip', clientId: 'c-5',
    startAt: day(0, 17), endAt: day(0, 21), // сегодня вечером
    status: 'CONFIRMED', source: 'REFERRAL', tariff: 'HOURLY', guests: 10,
    total: 100000, deposit: 50000, prepayment: 0,
    discountType: 'NONE', discountValue: 0,
    addons: [],
  },
  {
    id: 'b-12', resourceId: 'r-34vip', clientId: 'c-1',
    startAt: day(2, 12), endAt: day(2, 18),
    status: 'PREPAID', source: 'REGULAR', tariff: 'HOURLY', guests: 12,
    total: 135000, deposit: 0, prepayment: 70000, paymentMethod: 'KASPI',
    discountType: 'PERCENT', discountValue: 10, // 150 000 − 10%
    comment: 'Скидка постоянному гостю',
    addons: [{addonId: 'a-spa', qty: 2, priceAtBooking: 20000}],
  },

  // ── 6 VIP, караоке (10 000 ₸/ч) ──
  {
    id: 'b-13', resourceId: 'r-6vip', clientId: 'c-8',
    startAt: day(-1, 20), endAt: day(-1, 23),
    status: 'CANCELLED', source: 'INSTAGRAM', tariff: 'HOURLY', guests: 10,
    total: 30000, deposit: 50000, prepayment: 0,
    discountType: 'NONE', discountValue: 0, comment: 'Отмена за день',
    addons: [],
  },
  {
    id: 'b-14', resourceId: 'r-6vip', clientId: 'c-7',
    startAt: day(0, 21), endAt: day(1, 1), // сегодня ночью, через полночь
    status: 'ARRIVED', source: 'WIDGET', tariff: 'HOURLY', guests: 13,
    total: 40000, deposit: 50000, prepayment: 0, paymentMethod: 'CASH',
    discountType: 'NONE', discountValue: 0,
    addons: [{addonId: 'a-belly', qty: 1, priceAtBooking: 25000}],
  },
  {
    id: 'b-15', resourceId: 'r-6vip', clientId: 'c-4',
    startAt: day(2, 20), endAt: day(2, 23),
    status: 'NEW', source: 'WIDGET', tariff: 'HOURLY', guests: 8,
    total: 30000, deposit: 50000, prepayment: 0,
    discountType: 'NONE', discountValue: 0, comment: 'Онлайн-заявка',
    addons: [],
  },

  // ── Банкетный (депозит 200 000 ₸) ──
  {
    id: 'b-16', resourceId: 'r-banquet', clientId: 'c-6',
    startAt: day(-5, 18), endAt: day(-5, 23, 30),
    status: 'COMPLETED', source: 'B2B', tariff: 'CUSTOM', guests: 40,
    total: 350000, deposit: 200000, prepayment: 200000, paymentMethod: 'BANK',
    discountType: 'NONE', discountValue: 0, comment: 'Корпоратив, банкет на 40 персон',
    addons: [{addonId: 'a-vocal', qty: 1, priceAtBooking: 30000}],
  },
  {
    id: 'b-17', resourceId: 'r-banquet', clientId: 'c-1',
    startAt: day(1, 19), endAt: day(1, 23, 30),
    status: 'CONFIRMED', source: 'ADMIN', tariff: 'CUSTOM', guests: 35,
    total: 300000, deposit: 200000, prepayment: 150000, paymentMethod: 'KASPI',
    discountType: 'NONE', discountValue: 0, comment: 'Юбилей',
    addons: [{addonId: 'a-gogo', qty: 2, priceAtBooking: 25000}],
  },
  {
    id: 'b-18', resourceId: 'r-banquet', clientId: 'c-5',
    startAt: day(5, 17), endAt: day(5, 23),
    status: 'NEW', source: 'BLOGGERS', tariff: 'CUSTOM', guests: 30,
    total: 250000, deposit: 200000, prepayment: 0,
    discountType: 'NONE', discountValue: 0, comment: 'Съёмка + вечеринка',
    addons: [],
  },
];
