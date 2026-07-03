import {fromAlmaty} from './time';
import type {MockResource, MockAddon, MockClient, MockUser, MockBooking} from './types';

// Демо-данные для prisma/seed.ts (реальные 5 объектов из ТЗ §5.8 + демо-брони).
// DTO-типы приложения живут в lib/types.ts, enum-значения — в lib/enums.ts.

/** Стеночное время Almaty → инстант. */
const at = (y: number, m: number, d: number, h: number, min = 0) =>
  fromAlmaty(new Date(y, m - 1, d, h, min, 0, 0));

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
  {id: 'c-1', name: 'Алихан Серіков', phone: '+77011234567', dateOfBirth: new Date(Date.UTC(1990, 2, 15))},
  {id: 'c-2', name: 'Дмитрий Ким', phone: '+77019876543', dateOfBirth: new Date(Date.UTC(1988, 6, 3))},
  {id: 'c-3', name: 'Айгерім Нур', phone: '+77017778899', dateOfBirth: new Date(Date.UTC(1995, 10, 22))},
];

// ───────────────────────── Демо-брони (вокруг 22.06.2026) ──────────────

export const MOCK_BOOKINGS: MockBooking[] = [
  {
    id: 'b-1', resourceId: 'r-7vip', clientId: 'c-1',
    startAt: at(2026, 6, 22, 22, 0), endAt: at(2026, 6, 23, 2, 0), // через полночь
    status: 'CONFIRMED', source: 'PHONE', tariff: 'HOURLY', guests: 18,
    total: 140000, deposit: 0, prepayment: 50000, comment: 'День рождения',
    discountType: 'NONE', discountValue: 0,
    addons: [{addonId: 'a-hookah', qty: 2, priceAtBooking: 15000}],
  },
  {
    id: 'b-2', resourceId: 'r-25vip', clientId: 'c-2',
    startAt: at(2026, 6, 22, 14, 0), endAt: at(2026, 6, 22, 18, 0),
    status: 'PREPAID', source: 'WHATSAPP', tariff: 'HOURLY', guests: 10,
    total: 100000, deposit: 50000, prepayment: 50000,
    discountType: 'NONE', discountValue: 0,
    addons: [],
  },
  {
    id: 'b-3', resourceId: 'r-6vip', clientId: 'c-3',
    startAt: at(2026, 6, 22, 20, 0), endAt: at(2026, 6, 22, 23, 0),
    status: 'NEW', source: 'INSTAGRAM', tariff: 'HOURLY', guests: 12,
    total: 50000, deposit: 50000, prepayment: 0,
    discountType: 'NONE', discountValue: 0,
    addons: [{addonId: 'a-belly', qty: 1, priceAtBooking: 25000}],
  },
  {
    id: 'b-4', resourceId: 'r-banquet', clientId: 'c-1',
    startAt: at(2026, 6, 22, 19, 0), endAt: at(2026, 6, 22, 23, 30),
    status: 'CONFIRMED', source: 'ADMIN', tariff: 'CUSTOM', guests: 40,
    total: 350000, deposit: 200000, prepayment: 100000, comment: 'Корпоратив',
    discountType: 'NONE', discountValue: 0,
    addons: [{addonId: 'a-music', qty: 1, priceAtBooking: 20000}],
  },
  {
    id: 'b-5', resourceId: 'r-34vip', clientId: 'c-2',
    startAt: at(2026, 6, 23, 12, 0), endAt: at(2026, 6, 24, 12, 0), // сутки
    status: 'PREPAID', source: 'PHONE', tariff: 'FULL_DAY', guests: 11,
    total: 180000, deposit: 0, prepayment: 90000,
    discountType: 'NONE', discountValue: 0,
    addons: [],
  },
  {
    id: 'b-6', resourceId: 'r-7vip', clientId: 'c-3',
    startAt: at(2026, 6, 21, 16, 0), endAt: at(2026, 6, 21, 22, 0),
    status: 'COMPLETED', source: 'PHONE', tariff: 'HOURLY', guests: 20,
    total: 190000, deposit: 0, prepayment: 0, comment: 'Постоянный гость — скидка',
    discountType: 'AMOUNT', discountValue: 20000, // 210 000 − 20 000
    addons: [],
  },
];
