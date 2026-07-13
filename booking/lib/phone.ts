/**
 * Нормализация телефона к единому формату +7XXXXXXXXXX (ТЗ FR-CLI-5, FR-AUTH-1).
 * Используется и при входе, и при проверке уникальности клиентов/сотрудников.
 */
export function normalizePhone(input: string): string {
  let d = (input ?? '').replace(/\D/g, '');
  if (d.startsWith('8')) d = '7' + d.slice(1); // 8XXX… → 7XXX…
  if (d.length === 10) d = '7' + d; // без кода страны
  return d ? '+' + d : '';
}

/**
 * Live-форматирование поля телефона при вводе: префикс «+7» всегда на месте
 * (пустое поле → «+7», «8701…» → «+7701…»), максимум 11 цифр.
 */
export function formatPhoneDraft(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('8')) d = '7' + d.slice(1);
  if (d.length === 10) d = '7' + d; // вставили номер без кода страны
  if (!d.startsWith('7')) d = '7' + d;
  return '+' + d.slice(0, 11);
}
