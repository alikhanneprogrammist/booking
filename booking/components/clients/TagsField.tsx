'use client';

import {dialogField} from '@/lib/ui';

// Предустановленные теги-сегменты клиентов (теги — данные, админка ru-only).
export const PRESET_TAGS = ['VIP', 'Сегмент A', 'Сегмент B', 'Сегмент C', 'Сегмент D', 'Суточные гости'];

export const tagList = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

export function toggleTag(s: string, tag: string): string {
  const list = tagList(s);
  const next = list.includes(tag) ? list.filter((x) => x !== tag) : [...list, tag];
  return next.join(', ');
}

/**
 * Редактор тегов клиента: выпадающий список предустановленных сегментов,
 * выбранные — чипы с ✕, произвольные теги — текстовым полем (через запятую).
 * value — строка «через запятую» (state вызывающего).
 */
export default function TagsField({
  value, onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <>
      <select className={dialogField} value=""
        onChange={(e) => e.target.value && onChange(toggleTag(value, e.target.value))}>
        <option value="">+ Добавить тег…</option>
        {PRESET_TAGS.filter((tag) => !tagList(value).includes(tag)).map((tag) => (
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
        placeholder="свой тег через запятую" />
    </>
  );
}
