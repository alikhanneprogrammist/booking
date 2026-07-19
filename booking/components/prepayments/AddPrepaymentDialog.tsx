'use client';

import {useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {addArchivePrepayment} from '@/lib/actions';
import {dialogField, dialogLabel} from '@/lib/ui';
import type {MockResource, PaymentMethod} from '@/lib/types';

const PAYMENT_METHODS: PaymentMethod[] = ['KASPI', 'CASH', 'BANK'];

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Ручное добавление строки журнала предоплат (как строка в экселе бухгалтерии).
// Пишется в PrepaymentArchive — только журнал, в аналитику не попадает.
export default function AddPrepaymentDialog({
  resources, onClose,
}: {
  resources: MockResource[];
  onClose: () => void;
}) {
  const t = useTranslations('prepayments');
  const tpm = useTranslations('payment');
  const locale = useLocale();
  const router = useRouter();

  const name = (r: MockResource) => (locale === 'kk' ? r.nameKk : r.nameRu);
  const active = resources.filter((r) => r.isActive);

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod | ''>('');
  const [guest, setGuest] = useState('');
  const [resourceLabel, setResourceLabel] = useState(active[0] ? name(active[0]) : '');
  const [paidDate, setPaidDate] = useState(todayStr());
  const [visitDate, setVisitDate] = useState(todayStr());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    const sum = Math.round(Number(amount));
    if (!Number.isFinite(sum) || sum <= 0) return setError(t('errAmount'));
    if (!guest.trim()) return setError(t('errGuest'));
    if (!paidDate || !visitDate) return setError(t('errDates'));
    setSaving(true);
    try {
      // Даты — «стеночные» (полдень/полночь не важны: журнал группирует по дню Алматы).
      const res = await addArchivePrepayment({
        amount: sum,
        guest: guest.trim(),
        resourceLabel,
        paidAt: new Date(`${paidDate}T12:00:00`),
        visitAt: new Date(`${visitDate}T00:00:00`),
        paymentMethod: method || null,
        note: note.trim() || undefined,
      });
      if (!res.ok) {
        setError(t('errSave'));
        return;
      }
      router.refresh();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">{t('addTitle')}</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className={dialogLabel}>
            {t('amount')}
            <input type="number" min={1} className={dialogField} value={amount}
              onChange={(e) => setAmount(e.target.value)} autoFocus />
          </label>
          <label className={dialogLabel}>
            {t('type')}
            <select className={dialogField} value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod | '')}>
              <option value="">—</option>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{tpm(m)}</option>)}
            </select>
          </label>
        </div>

        <label className={`${dialogLabel} mt-3`}>
          {t('guest')}
          <input className={dialogField} value={guest} onChange={(e) => setGuest(e.target.value)} />
        </label>

        <label className={`${dialogLabel} mt-3`}>
          {t('resource')}
          <select className={dialogField} value={resourceLabel}
            onChange={(e) => setResourceLabel(e.target.value)}>
            {active.map((r) => <option key={r.id} value={name(r)}>{name(r)}</option>)}
          </select>
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className={dialogLabel}>
            {t('paidDate')}
            <input type="date" className={dialogField} value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)} />
          </label>
          <label className={dialogLabel}>
            {t('visitDate')}
            <input type="date" className={dialogField} value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)} />
          </label>
        </div>

        <label className={`${dialogLabel} mt-3`}>
          {t('note')}
          <textarea className={dialogField} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        {error && (
          <div role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40">{error}</div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-subtle">
            {t('cancel')}
          </button>
          <button onClick={submit} disabled={saving}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {saving ? '…' : t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
