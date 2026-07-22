'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {addDeliveryOrder, updateDeliveryOrder} from '@/lib/actions';
import {formatPhoneDraft} from '@/lib/phone';
import {dialogField, dialogLabel} from '@/lib/ui';
import {toAlmaty} from '@/lib/time';
import type {DeliveryOrder} from '@/lib/types';

// Телефон необязателен, а в импортированных из экселя днях бывает несколько
// номеров через запятую/слэш — такие строки не переформатируем, чтобы не
// потерять данные при правке. Одиночный номер — live-формат как везде.
const phoneDraft = (v: string, prev: string) =>
  v.trim() === '' || /[,;/]/.test(v) ? v : formatPhoneDraft(v, prev);

const dateStr = (d: Date) => {
  const w = toAlmaty(d);
  return `${w.getFullYear()}-${String(w.getMonth() + 1).padStart(2, '0')}-${String(w.getDate()).padStart(2, '0')}`;
};

// Добавление/правка заказа внутренней доставки (строка экселя «Свод недельной
// Внутренней Доставки»). Пишется в DeliveryOrder — только журнал «Доставка».
export default function DeliveryOrderDialog({
  order, onClose,
}: {
  order?: DeliveryOrder; // есть — правка, нет — новый заказ
  onClose: () => void;
}) {
  const t = useTranslations('delivery');
  const router = useRouter();

  const [date, setDate] = useState(dateStr(order?.date ?? new Date()));
  const [amount, setAmount] = useState(order ? String(order.amount) : '');
  const [courierCost, setCourierCost] = useState(order?.courierCost != null ? String(order.courierCost) : '');
  const [address, setAddress] = useState(order?.address ?? '');
  const [phone, setPhone] = useState(order?.phone ?? '');
  const [promo, setPromo] = useState(order?.promo ?? '');
  const [note, setNote] = useState(order?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    const sum = Math.round(Number(amount));
    if (!Number.isFinite(sum) || sum <= 0) return setError(t('errAmount'));
    if (!date) return setError(t('errDate'));
    const courier = courierCost.trim() === '' ? null : Math.round(Number(courierCost));
    if (courier !== null && (!Number.isFinite(courier) || courier < 0)) return setError(t('errCourier'));
    setSaving(true);
    try {
      // Дата «стеночная» (полдень — журнал группирует по дню Алматы).
      const input = {
        date: new Date(`${date}T12:00:00`),
        amount: sum,
        courierCost: courier,
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        promo: promo.trim() || undefined,
        note: note.trim() || undefined,
      };
      const res = await (order ? updateDeliveryOrder(order.id, input) : addDeliveryOrder(input));
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
          <h2 className="text-base font-semibold tracking-tight">{order ? t('editTitle') : t('addTitle')}</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">✕</button>
        </div>

        <label className={dialogLabel}>
          {t('date')}
          <input type="date" className={dialogField} value={date}
            onChange={(e) => setDate(e.target.value)} />
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className={dialogLabel}>
            {t('amount')}
            <input type="number" min={1} className={dialogField} value={amount}
              onChange={(e) => setAmount(e.target.value)} autoFocus />
          </label>
          <label className={dialogLabel}>
            {t('courierCost')}
            <input type="number" min={0} className={dialogField} value={courierCost}
              onChange={(e) => setCourierCost(e.target.value)} />
          </label>
        </div>

        <label className={`${dialogLabel} mt-3`}>
          {t('address')}
          <input className={dialogField} value={address} placeholder={t('addressHint')}
            onChange={(e) => setAddress(e.target.value)} />
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className={dialogLabel}>
            {t('phone')}
            <input type="tel" className={dialogField} value={phone}
              onChange={(e) => setPhone(phoneDraft(e.target.value, phone))} />
          </label>
          <label className={dialogLabel}>
            {t('promo')}
            <input className={dialogField} value={promo} placeholder={t('promoHint')}
              onChange={(e) => setPromo(e.target.value)} />
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
