/**
 * Слияние тегов клиента: существующие остаются в исходном порядке, новые
 * добавляются в конец. Дубликаты отбрасываются без учёта регистра — первый
 * встреченный вариант написания побеждает («VIP» + «vip» → «VIP»).
 */
export function mergeTags(existing: string[], incoming: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const tag of [...existing, ...incoming]) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(tag);
  }
  return merged;
}
