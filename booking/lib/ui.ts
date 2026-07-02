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
