// Анти-спам для публичных экшенов (формы /book без CAPTCHA).
// In-memory на процесс: приложение живёт в одном контейнере, этого достаточно.
// Рестарт обнуляет счётчики — приемлемо для защиты от ручного/скриптового спама.

const WINDOW_MS = 10 * 60_000; // окно 10 минут
const IP_LIMIT = 5; // заявок с одного IP за окно
const GLOBAL_LIMIT = 30; // суммарный потолок (против распределённого спама)

const submitLog = new Map<string, number[]>();

/** true — лимит исчерпан (попытка НЕ записывается); false — попытка учтена. */
export function rateLimited(ip: string, now = Date.now()): boolean {
  // Прунинг устаревших записей (карта не растёт бесконечно) + подсчёт суммарного объёма.
  let totalCount = 0;
  const stale: string[] = [];
  submitLog.forEach((times, key) => {
    const fresh = times.filter((t) => now - t < WINDOW_MS);
    if (fresh.length === 0) stale.push(key);
    else {
      submitLog.set(key, fresh);
      totalCount += fresh.length;
    }
  });
  stale.forEach((key) => submitLog.delete(key));

  const perIp = submitLog.get(ip) ?? [];
  if (perIp.length >= IP_LIMIT || totalCount >= GLOBAL_LIMIT) return true;
  submitLog.set(ip, [...perIp, now]);
  return false;
}
