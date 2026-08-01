'use client';

import {dialogField} from '@/lib/ui';

// Предустановленные виды мероприятий (значения — данные, админка ru-only).
// Заменили прежние теги-сегменты; старые теги у клиентов остаются отображаться.
export const EVENT_TYPES = [
  'День рождения', 'Корпоратив', 'Юбилей', 'Девичник', 'Мальчишник',
  'Деловая встреча', 'Семейный ужин', 'Афтепати', 'Другое',
];

/** Вид «День рождения» — триггер синхронизации даты рождения клиента из брони. */
export const BIRTHDAY_EVENT = 'День рождения';

export const tagList = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

export function toggleTag(s: string, tag: string): string {
  const list = tagList(s);
  const next = list.includes(tag) ? list.filter((x) => x !== tag) : [...list, tag];
  return next.join(', ');
}

/**
 * Редактор видов мероприятий клиента: выпадающий список предустановленных,
 * выбранные — чипы с ✕, произвольные — текстовым полем (через запятую).
 * value — строка «через запятую» (state вызывающего).
 * excludeFromPresets — виды, которые не предлагать в селекте (уже есть у клиента).
 */
export default function TagsField({
  value, onChange, excludeFromPresets = [],
}: {
  value: string;
  onChange: (next: string) => void;
  excludeFromPresets?: string[];
}) {
  const hidden = [...tagList(value), ...excludeFromPresets];
  return (
    <>
      <select className={dialogField} value=""
        onChange={(e) => e.target.value && onChange(toggleTag(value, e.target.value))}>
        <option value="">+ Добавить вид…</option>
        {EVENT_TYPES.filter((tag) => !hidden.includes(tag)).map((tag) => (
          <option key={tag} value={tag}>{tag}</option>
        ))}
      </select>
      {tagList(value).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tagList(value).map((tag) => (
            <span key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-subtle px-2.5 py-1 text-xs font-medium">
              {tag}
              <button type="button" aria-label={`убрать ${tag}`}
                onClick={() => onChange(toggleTag(value, tag))}
                className="text-muted hover:text-red-600">✕</button>
            </span>
          ))}
        </div>
      )}
      <input className={dialogField} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="свой вид через запятую" />
    </>
  );
}
