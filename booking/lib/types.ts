import type {Tariff, DiscountType, BookingStatus, BookingSource, PaymentMethod, Role} from './enums';

// DTO-типы приложения: форма Prisma-моделей с числовыми ценами вместо Decimal
// (см. маппинг в lib/queries.ts). Исторические имена Mock* сохранены —
// они закрепились по всем компонентам со времён мок-этапа.

export type {Tariff, DiscountType, BookingStatus, BookingSource, PaymentMethod, Role};

export interface MockResource {
  id: string;
  kind: 'COMPLEX' | 'KARAOKE';
  nameRu: string;
  nameKk: string;
  capacity: number;
  color: string;
  photos: string[];
  isActive: boolean;
  sortOrder: number;
  floors: string[];
  hasKaraoke: boolean;
  hasFinnishSauna: boolean;
  hasHammam: boolean;
  hasPool: boolean;
  hasBanquet: boolean;
  restRooms: number;
  hasKitchen: boolean;
  hourlyPrice: number;
  minHours: number;
  halfDayPrice: number | null;
  fullDayPrice: number | null;
  weekendPrice: number | null;
  weekdayMinDeposit: number | null;
  priceNote?: string;
}

export interface MockAddon {
  id: string;
  nameRu: string;
  nameKk: string;
  price: number;
  unit: 'PER_EVENT' | 'PER_ITEM';
}

export interface MockClient {
  id: string;
  name: string;
  phone: string;
  note?: string;
  tags?: string[];
  dateOfBirth?: Date; // день рождения (календарная дата, UTC-полночь)
}

export interface MockUser {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: Role;
  isActive: boolean;
}

export interface MockBooking {
  id: string;
  resourceId: string;
  clientId: string;
  startAt: Date;
  endAt: Date;
  status: BookingStatus;
  source: BookingSource;
  tariff: Tariff;
  guests: number;
  total: number;
  deposit: number;
  prepayment: number;
  paymentMethod?: PaymentMethod; // Каспи/Нал/Банк; undefined — не задано
  discountType: DiscountType;
  discountValue: number;
  comment?: string;
  addons: {addonId: string; qty: number; priceAtBooking: number}[];
}
