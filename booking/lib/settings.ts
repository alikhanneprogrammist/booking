// Настройки заведения (singleton) — DTO + дефолты.
// Серверное чтение: getSettings (lib/queries.ts). Запись: saveSettings (lib/actions.ts).

export const SETTINGS_ID = 'singleton';

export type AppSettings = {
  // Заведение
  companyName: string;
  logoUrl: string; // data-URL логотипа ('' = нет)
  phone: string;
  whatsapp: string;
  instagram: string;
  email: string;
  address: string;
  requisites: string;
  // Глобальные правила брони
  minBookingHours: number;
  prepaymentPercent: number;
  // Публичная страница заявок /book (двуязычно; пусто → i18n-дефолт)
  publicTitleRu: string;
  publicTitleKk: string;
  publicSubtitleRu: string;
  publicSubtitleKk: string;
  publicInfoRu: string;
  publicInfoKk: string;
  publicContacts: string;
};

/** Значения по умолчанию, когда строки настроек ещё нет в БД. */
export const DEFAULT_SETTINGS: AppSettings = {
  companyName: 'OFFICE 2020',
  logoUrl: '',
  minBookingHours: 3,
  prepaymentPercent: 0,
  phone: '',
  whatsapp: '',
  instagram: '',
  email: '',
  address: '',
  requisites: '',
  publicTitleRu: '',
  publicTitleKk: '',
  publicSubtitleRu: '',
  publicSubtitleKk: '',
  publicInfoRu: '',
  publicInfoKk: '',
  publicContacts: '',
};
