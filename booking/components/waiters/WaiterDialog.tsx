'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {saveWaiter} from '@/lib/actions';
import type {MockWaiter} from '@/lib/mock-data';

export default function WaiterDialog({
  waiter, onClose, onSaved,
}: {
  waiter?: MockWaiter;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const t = useTranslations('waiters');
  const w = waiter;
  const [name, setName] = useState(w?.name ?? '');
  const [sortOrder, setSortOrder] = useState(String(w?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(w?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await saveWaiter({
        id: w?.id, name: name.trim(), isActive,
        sortOrder: Number(sortOrder) || 0,
      });
      if (!res.ok) {
        setSaving(false);
        alert(t('invalidName'));
        return;
      }
    } catch {
      setSaving(false);
      alert(t('actionError'));
      return;
    }
    setSaving(false);
    onSaved?.();
    onClose();
  }

  const field = 'rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-foreground/40';
  const label = 'flex flex-col gap-1 text-xs font-medium text-muted';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">{w ? t('edit') : t('add')}</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">✕</button>
        </div>
        <div className="flex flex-col gap-3">
          <label className={label}>{t('name')}<input className={field} value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
          <label className={label}>{t('sortOrder')}<input type="number" className={field} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} /></label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            {t('active')}
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-subtle">{t('back')}</button>
          <button onClick={save} disabled={saving || !name.trim()} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {w ? t('save') : t('create')}
          </button>
        </div>
      </div>
    </div>
  );
}
