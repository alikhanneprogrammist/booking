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
