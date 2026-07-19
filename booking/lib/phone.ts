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
 *
 * prev — предыдущее значение поля. Если текст стал короче, это стирание:
 * правило «10 цифр без "+" → дописать код страны» НЕ применяется — иначе
 * backspace, задевший «+», превращал остаток в «голую вставку», семёрка
 * дорисовывалась снова и в поле росло «777…». Итоговую нормализацию
 * (в т.ч. код страны) всё равно делает normalizePhone на сохранении.
 */
export function formatPhoneDraft(raw: string, prev = ''): string {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('8')) d = '7' + d.slice(1);
  const isDeleting = prev !== '' && raw.length < prev.length;
  // Код страны дорисовываем только «голой» вставке (10 цифр БЕЗ «+» в начале),
  // и только когда это не стирание.
  if (d.length === 10 && !raw.trim().startsWith('+') && !isDeleting) d = '7' + d;
  if (!d.startsWith('7')) d = '7' + d;
  return '+' + d.slice(0, 11);
}
