// Общие Tailwind-строки форм и диалогов — единый вид, правится в одном месте.
// (Публичная форма /book намеренно крупнее — свои константы, сюда не входят.)

/** Поле ввода в модальных диалогах (бронь, клиент, сотрудник, услуга, объект). */
export const dialogField =
  'rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-foreground/40';

/** Подпись поля в модальных диалогах. */
export const dialogLabel = 'flex flex-col gap-1 text-xs font-medium text-muted';

/** Поле ввода в админ-формах настроек. */
export const adminInput =
  'w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary';

/** Заголовок секции (аналитика, дни рождения). */
export const sectionHead = 'mb-2 text-sm font-medium uppercase tracking-wide text-muted';

/** Чип источника клиента (синий) — список клиентов и карточка. */
export const sourceChip =
  'rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:ring-sky-900';

/** Чип тега клиента: «VIP» — янтарный (как в календаре), остальные — фиолетовые. */
export function tagChip(tag: string): string {
  const base = 'rounded px-1.5 py-0.5 text-[10px] font-medium ring-1';
  return tag.trim().toLowerCase() === 'vip'
    ? `${base} bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900`
    : `${base} bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:ring-violet-900`;
}
