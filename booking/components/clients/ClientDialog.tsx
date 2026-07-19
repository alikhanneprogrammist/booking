'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {saveClient} from '@/lib/actions';
import {toInputValue, parseInputDate} from '@/lib/birthdays';
import {formatPhoneDraft} from '@/lib/phone';
import type {MockClient} from '@/lib/types';
import {dialogField, dialogLabel} from '@/lib/ui';

// Предустановленные теги-сегменты клиентов (теги — данные, админка ru-only).
const PRESET_TAGS = ['VIP', 'Сегмент A', 'Сегмент B', 'Сегмент C', 'Сегмент D', 'Суточные гости'];

const tagList = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

function toggleTag(s: string, tag: string): string {
  const list = tagList(s);
  const next = list.includes(tag) ? list.filter((x) => x !== tag) : [...list, tag];
  return next.join(', ');
}

export default function ClientDialog({
  mode, client, onClose, onSaved,
}: {
  mode: 'create' | 'edit';
  client?: MockClient;
  onClose: () => void;
  onSaved?: (c: MockClient) => void;
}) {
  const t = useTranslations('clients');
  const [name, setName] = useState(client?.name ?? '');
  const [phone, setPhone] = useState(formatPhoneDraft(client?.phone ?? ''));
  const [note, setNote] = useState(client?.note ?? '');
  const [tags, setTags] = useState((client?.tags ?? []).join(', '));
  const [dob, setDob] = useState(client?.dateOfBirth ? toInputValue(client.dateOfBirth) : '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setError(null);
    setSaving(true);
    const res = await saveClient({
      id: client?.id,
      name: name.trim(),
      phone: phone.trim(),
      note: note.trim() || undefined,
      tags: tags.split(',').map((s) => s.trim()).filter(Boolean),
      dateOfBirth: dob ? parseInputDate(dob) : undefined,
    });
    setSaving(false);
    if (!res.ok) {
      setError(t('duplicatePhone')); // единственная ожидаемая ошибка — занятый телефон
      return;
    }
    onSaved?.(res.client);
    onClose();
  }

  const field = dialogField;
  const label = dialogLabel;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">{mode === 'create' ? t('add') : t('edit')}</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">✕</button>
        </div>
        <div className="flex flex-col gap-3">
          <label className={label}>
            {t('name')}
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <label className={label}>
            {t('phone')}
            <input className={field} type="tel" value={phone} onChange={(e) => setPhone(formatPhoneDraft(e.target.value, phone))} placeholder="+7 700 000 00 00" />
          </label>
          <label className={label}>
            {t('note')}
            <textarea className={field} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className={label}>
            {t('tags')}
            {/* Предустановленные теги-сегменты: клик добавляет/убирает из списка */}
            <div className="flex flex-wrap gap-1.5">
              {PRESET_TAGS.map((tag) => {
                const active = tagList(tags).includes(tag);
                return (
                  <button key={tag} type="button" onClick={() => setTags(toggleTag(tags, tag))}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border bg-subtle text-muted hover:text-foreground'
                    }`}>
                    {tag}
                  </button>
                );
              })}
            </div>
            <input className={field} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="свой тег через запятую" />
          </div>
          <label className={label}>
            {t('dateOfBirth')}
            <input type="date" className={field} value={dob} onChange={(e) => setDob(e.target.value)} />
          </label>
          {error && <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40">{error}</div>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-subtle">
            {t('back')}
          </button>
          <button
            onClick={save}
            disabled={saving || !name.trim() || phone.replace(/\D/g, '').length <= 1}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {mode === 'create' ? t('create') : t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
