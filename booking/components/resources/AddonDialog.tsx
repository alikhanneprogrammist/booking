'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {saveAddon} from '@/lib/actions';
import type {MockAddon} from '@/lib/mock-data';
import {dialogField, dialogLabel} from '@/lib/ui';

export default function AddonDialog({
  addon, onClose, onSaved,
}: {
  addon?: MockAddon;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const t = useTranslations('resources');
  const a = addon;
  const [nameRu, setNameRu] = useState(a?.nameRu ?? '');
  const [nameKk, setNameKk] = useState(a?.nameKk ?? '');
  const [price, setPrice] = useState(String(a?.price ?? 0));
  const [unit, setUnit] = useState<'PER_EVENT' | 'PER_ITEM'>(a?.unit ?? 'PER_ITEM');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await saveAddon({id: a?.id, nameRu, nameKk, price: Number(price), unit});
    setSaving(false);
    onSaved?.();
    onClose();
  }

  const field = dialogField;
  const label = dialogLabel;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">{a ? t('edit') : t('addAddon')}</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">✕</button>
        </div>
        <div className="flex flex-col gap-3">
          <label className={label}>{t('nameRu')}<input className={field} value={nameRu} onChange={(e) => setNameRu(e.target.value)} autoFocus /></label>
          <label className={label}>{t('nameKk')}<input className={field} value={nameKk} onChange={(e) => setNameKk(e.target.value)} /></label>
          <label className={label}>{t('price')}<input type="number" className={field} value={price} onChange={(e) => setPrice(e.target.value)} /></label>
          <label className={label}>{t('unit')}
            <select className={field} value={unit} onChange={(e) => setUnit(e.target.value as 'PER_EVENT' | 'PER_ITEM')}>
              <option value="PER_ITEM">{t('PER_ITEM')}</option>
              <option value="PER_EVENT">{t('PER_EVENT')}</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-subtle">{t('back')}</button>
          <button onClick={save} disabled={saving || !nameRu.trim()} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {a ? t('save') : t('create')}
          </button>
        </div>
      </div>
    </div>
  );
}
