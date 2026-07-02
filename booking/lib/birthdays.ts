// Дни рождения — календарная дата (без времени). Храним как UTC-полночь и сравниваем
// по UTC-компонентам, чтобы дата не «плыла» между таймзонами (иначе off-by-one на дне).
//
// `Today` — сегодняшняя дата в Алматы как чистые компоненты (год/месяц 0-11/день),
// вычисляется вызывающим кодом через toAlmaty(new Date()) + локальные геттеры
// (как в lib/calendar.ts). Здесь модуль остаётся без зависимостей и легко тестируется.

export interface Today {
  year: number;
  month: number; // 0-11
  day: number; // 1-31
}

/** Дата → 'YYYY-MM-DD' (UTC) для <input type="date">. */
export function toInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' → UTC-полночь (корректный round-trip с toInputValue). */
export function parseInputDate(v: string): Date {
  return new Date(v + 'T00:00:00.000Z');
}

/** Месяц (0-11) и день (1-31) даты рождения по UTC. */
export function monthDay(dob: Date): {month: number; day: number} {
  return {month: dob.getUTCMonth(), day: dob.getUTCDate()};
}

/**
 * UTC-метка ближайшего дня рождения (>= сегодня). 29 февраля в невисокосный год
 * переполняется в 1 марта (Date.UTC) — единая конвенция для daysUntil и ageTurning.
 */
function nextBirthdayUtc(dob: Date, today: Today): number {
  const {month, day} = monthDay(dob);
  const todayUtc = Date.UTC(today.year, today.month, today.day);
  let next = Date.UTC(today.year, month, day);
  if (next < todayUtc) next = Date.UTC(today.year + 1, month, day);
  return next;
}

/** Дней до ближайшего дня рождения (>= 0; 0 — сегодня). */
export function daysUntilBirthday(dob: Date, today: Today): number {
  const todayUtc = Date.UTC(today.year, today.month, today.day);
  return Math.round((nextBirthdayUtc(dob, today) - todayUtc) / 86_400_000);
}

/** Возраст, который исполнится на ближайший день рождения. */
export function ageTurning(dob: Date, today: Today): number {
  return new Date(nextBirthdayUtc(dob, today)).getUTCFullYear() - dob.getUTCFullYear();
}

/** Локализованная дата рождения «15 марта» (UTC — без сдвига дня). */
export function formatBirthday(dob: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {day: 'numeric', month: 'long', timeZone: 'UTC'}).format(dob);
}

/** Клиенты с ДР в ближайшие `days` дней (сегодня = день 1 из `days`), по близости. */
export function upcomingBirthdays<T extends {dateOfBirth?: Date}>(
  clients: T[],
  today: Today,
  days = 7,
): Array<T & {daysUntil: number}> {
  return clients
    .filter((c) => c.dateOfBirth)
    .map((c) => ({...c, daysUntil: daysUntilBirthday(c.dateOfBirth as Date, today)}))
    .filter((c) => c.daysUntil < days) // полуоткрыто: «7 дней» = daysUntil 0..6
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

/** Клиенты с ДР в указанном месяце (0-11), отсортированные по дню. */
export function birthdaysInMonth<T extends {dateOfBirth?: Date}>(clients: T[], month: number): T[] {
  return clients
    .filter((c) => c.dateOfBirth && (c.dateOfBirth as Date).getUTCMonth() === month)
    .sort((a, b) => (a.dateOfBirth as Date).getUTCDate() - (b.dateOfBirth as Date).getUTCDate());
}
