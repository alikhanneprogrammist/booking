'use client';

import {useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {addArchivePrepayment, updateArchivePrepayment, updateBookingPrepayment} from '@/lib/actions';
import {dialogField, dialogLabel} from '@/lib/ui';
import {toAlmaty} from '@/lib/time';
import type {MockResource, PaymentMethod} from '@/lib/types';
import type {JournalRow} from './PrepaymentsView';

const ARCHIVE_METHODS: PaymentMethod[] = ['KASPI', 'CASH', 'BANK'];

const dateStr = (d: Date) => {
  const w = toAlmaty(d);
  return `${w.getFullYear()}-${String(w.getMonth() + 1).padStart(2, '0')}-${String(w.getDate()).padStart(2, '0')}`;
};

// Добавление/правка строки журнала предоплат (как строка в экселе бухгалтерии).
// Без row — новая строка PrepaymentArchive (только журнал, в аналитику не попадает).
// С row: архивная строка правится целиком; у строки из брони — только
// сумма/тип/дата оплаты (гость и дата посещения правятся в самой брони).
export default function AddPrepaymentDialog({
  resources, row, onClose,
}: {
  resources: MockResource[];
  row?: JournalRow; // есть — правка (только ADMIN), нет — новая строка
  onClose: () => void;
}) {
  const t = useTranslations('prepayments');
  const tpm = useTranslations('payment');
  const locale = useLocale();
  const router = useRouter();

  const name = (r: MockResource) => (locale === 'kk' ? r.nameKk : r.nameRu);
  const active = resources.filter((r) => r.isActive);
  const isBookingRow = !!row && !row.isArchive;
  // У брони тип оплаты может быть и «Нал+Каспи» — в архиве такого типа нет.
  const methods: PaymentMethod[] = isBookingRow ? [...ARCHIVE_METHODS, 'CASH_KASPI'] : ARCHIVE_METHODS;
  // Метки залов архива — свободный текст из экселя; чужую метку не теряем.
  const resourceOptions = active.map(name);
  if (row && row.resourceLabel && !resourceOptions.includes(row.resourceLabel)) {
    resourceOptions.unshift(row.resourceLabel);
  }

  const [amount, setAmount] = useState(row ? String(Math.round(row.amount)) : '');
  const [method, setMethod] = useState<PaymentMethod | ''>(row?.method ?? '');
  const [guest, setGuest] = useState(row?.guest ?? '');
  const [resourceLabel, setResourceLabel] = useState(
    row ? row.resourceLabel : active[0] ? name(active[0]) : '',
  );
  const [paidDate, setPaidDate] = useState(row?.paidAt ? dateStr(row.paidAt) : dateStr(new Date()));
  const [visitDate, setVisitDate] = useState(row ? dateStr(row.visitAt) : dateStr(new Date()));
  const [note, setNote] = useState(row?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    const sum = Math.round(Number(amount));
    if (!Number.isFinite(sum) || sum <= 0) return setError(t('errAmount'));
    if (!isBookingRow && !guest.trim()) return setError(t('errGuest'));
    if (!paidDate || !visitDate) return setError(t('errDates'));
    setSaving(true);
    try {
      // Даты — «стеночные» (полдень/полночь не важны: журнал группирует по дню Алматы).
      let res: {ok: boolean};
      if (isBookingRow) {
        res = await updateBookingPrepayment(row!.id, {
          amount: sum,
          paymentMethod: method || null,
          paidAt: new Date(`${paidDate}T12:00:00`),
        });
      } else {
        const input = {
          amount: sum,
          guest: guest.trim(),
          resourceLabel,
          paidAt: new Date(`${paidDate}T12:00:00`),
          visitAt: new Date(`${visitDate}T00:00:00`),
          paymentMethod: method || null,
          note: note.trim() || undefined,
        };
        res = await (row ? updateArchivePrepayment(row.id, input) : addArchivePrepayment(input));
      }
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
          <h2 className="text-base font-semibold tracking-tight">{row ? t('editTitle') : t('addTitle')}</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">✕</button>
        </div>

        {isBookingRow && (
          <div className="mb-3 rounded-md bg-subtle px-3 py-2 text-xs text-muted">{t('editBookingHint')}</div>
        )}

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
              {methods.map((m) => <option key={m} value={m}>{tpm(m)}</option>)}
            </select>
          </label>
        </div>

        <label className={`${dialogLabel} mt-3`}>
          {t('guest')}
          <input className={dialogField} value={guest} disabled={isBookingRow}
            onChange={(e) => setGuest(e.target.value)} />
        </label>

        <label className={`${dialogLabel} mt-3`}>
          {t('resource')}
          <select className={dialogField} value={resourceLabel} disabled={isBookingRow}
            onChange={(e) => setResourceLabel(e.target.value)}>
            {resourceOptions.map((label) => <option key={label} value={label}>{label}</option>)}
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
            <input type="date" className={dialogField} value={visitDate} disabled={isBookingRow}
              onChange={(e) => setVisitDate(e.target.value)} />
          </label>
        </div>

        <label className={`${dialogLabel} mt-3`}>
          {t('note')}
          <textarea className={dialogField} rows={2} value={note} disabled={isBookingRow}
            onChange={(e) => setNote(e.target.value)} />
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
