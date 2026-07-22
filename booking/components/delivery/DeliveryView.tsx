'use client';

import {useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {toAlmaty} from '@/lib/time';
import {addDays} from '@/lib/calendar';
import {removeDeliveryOrder} from '@/lib/actions';
import DeliveryOrderDialog from './DeliveryOrderDialog';
import type {DeliveryOrder} from '@/lib/types';

// Итоги недели для строки сравнения «итого за прошлую неделю» (как в экселе).
export type DeliveryTotals = {count: number; amount: number; courier: number};

// Журнал внутренней доставки — колонки как в экселе «Свод недельной Внутренней
// Доставки»: Дата · Сумма · Курьер · Адрес · Телефон · Акция · Примечание · Ответственный.
export default function DeliveryView({
  orders, weekStartIso, prevTotals, isAdmin,
}: {
  orders: DeliveryOrder[];
  weekStartIso: string;
  prevTotals: DeliveryTotals;
  isAdmin: boolean;
}) {
  const t = useTranslations('delivery');
  const locale = useLocale();
  const router = useRouter();

  const from = new Date(weekStartIso);
  const lastDay = addDays(from, 6);

  const intl = locale === 'kk' ? 'kk-KZ' : 'ru-RU';
  const money = (n: number) => `${Math.round(n).toLocaleString(locale)} ₸`;
  const fmtShort = (d: Date) =>
    toAlmaty(d).toLocaleDateString(intl, {day: '2-digit', month: '2-digit'});
  const fmtDate = (d: Date) =>
    toAlmaty(d).toLocaleDateString(intl, {day: '2-digit', month: '2-digit', year: 'numeric'});
  const weekday = (d: Date) => toAlmaty(d).toLocaleDateString(intl, {weekday: 'long'});

  const weekLabel = `${fmtShort(from)} – ${fmtDate(lastDay)}`;

  // Навигация по неделям — как листы «13.07-19.07» в экселе.
  const shift = (delta: number) => {
    const w = toAlmaty(addDays(from, delta * 7));
    const p = (n: number) => String(n).padStart(2, '0');
    router.replace(`/delivery?w=${w.getFullYear()}-${p(w.getMonth() + 1)}-${p(w.getDate())}`);
  };

  const totalAmount = orders.reduce((s, o) => s + o.amount, 0);
  const totalCourier = orders.reduce((s, o) => s + (o.courierCost ?? 0), 0);

  const [dialog, setDialog] = useState<{order?: DeliveryOrder} | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Удаление строки журнала — только ADMIN (менеджеры добавляют и правят).
  async function removeRow(o: DeliveryOrder) {
    if (!window.confirm(t('deleteConfirm'))) return;
    setDeletingId(o.id);
    try {
      await removeDeliveryOrder(o.id);
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  // Выгрузка недели в .xlsx — те же колонки, что в экселе доставки.
  async function downloadXlsx() {
    const XLSX = await import('xlsx');
    const header = [
      t('date'), t('weekday'), t('amount'), t('courierCost'),
      t('address'), t('phone'), t('promo'), t('note'), t('manager'),
    ];
    const dataRows = orders.map((o) => [
      fmtDate(o.date),
      weekday(o.date),
      Math.round(o.amount),
      o.courierCost != null ? Math.round(o.courierCost) : '—',
      o.address || '—',
      o.phone || '—',
      o.promo || '—',
      o.note || '—',
      o.manager || '—',
    ]);
    const ws = XLSX.utils.aoa_to_sheet([
      header,
      ...dataRows,
      [t('weekTotal'), String(orders.length), Math.round(totalAmount), Math.round(totalCourier)],
      [t('prevWeekTotal'), String(prevTotals.count), Math.round(prevTotals.amount), Math.round(prevTotals.courier)],
    ]);
    ws['!cols'] = header.map(() => ({wch: 18}));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, weekLabel.replaceAll('–', '-'));
    XLSX.writeFile(wb, `${t('fileName')}-${weekLabel.replaceAll(' ', '').replaceAll('–', '-')}.xlsx`);
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} aria-label="prev"
            className="rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-subtle">‹</button>
          <span className="min-w-44 px-2 text-center text-sm font-medium">{weekLabel}</span>
          <button onClick={() => shift(1)} aria-label="next"
            className="rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-subtle">›</button>
          <button onClick={downloadXlsx}
            className="ml-2 rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-subtle">
            ⬇ {t('download')}
          </button>
          <button onClick={() => setDialog({})}
            className="ml-1 rounded-md bg-primary px-2.5 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
            + {t('add')}
          </button>
        </div>
      </div>

      {/* Итоги недели + сравнение с прошлой (строки «итого» из экселя) */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:max-w-2xl">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted">{t('countWeek')}</div>
          <div className="mt-0.5 text-lg font-semibold">{orders.length}</div>
          <div className="mt-0.5 text-xs text-muted">{t('prevWeek')}: {prevTotals.count}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted">{t('amountWeek')}</div>
          <div className="mt-0.5 text-lg font-semibold">{money(totalAmount)}</div>
          <div className="mt-0.5 text-xs text-muted">{t('prevWeek')}: {money(prevTotals.amount)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted">{t('courierWeek')}</div>
          <div className="mt-0.5 text-lg font-semibold">{money(totalCourier)}</div>
          <div className="mt-0.5 text-xs text-muted">{t('prevWeek')}: {money(prevTotals.courier)}</div>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="mt-6 rounded-lg border border-border bg-card p-6 text-sm text-muted">{t('empty')}</div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2">{t('date')}</th>
                <th className="px-3 py-2">{t('amount')}</th>
                <th className="px-3 py-2">{t('courierCost')}</th>
                <th className="px-3 py-2">{t('address')}</th>
                <th className="px-3 py-2">{t('phone')}</th>
                <th className="px-3 py-2">{t('promo')}</th>
                <th className="px-3 py-2">{t('note')}</th>
                <th className="px-3 py-2">{t('manager')}</th>
                <th className="w-8 px-2 py-2" />
                {isAdmin && <th className="w-8 px-2 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="whitespace-nowrap px-3 py-2">
                    {fmtShort(o.date)} <span className="text-xs text-muted">{weekday(o.date)}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-medium">{money(o.amount)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{o.courierCost != null ? money(o.courierCost) : '—'}</td>
                  <td className="max-w-44 truncate px-3 py-2" title={o.address}>{o.address || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2">{o.phone || '—'}</td>
                  <td className="max-w-36 truncate px-3 py-2" title={o.promo}>{o.promo || '—'}</td>
                  <td className="max-w-44 truncate px-3 py-2" title={o.note}>{o.note || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2">{o.manager || '—'}</td>
                  <td className="px-2 py-2 text-center">
                    <button onClick={() => setDialog({order: o})}
                      aria-label={t('editRow')} title={t('editRow')}
                      className="text-muted hover:text-foreground">✎</button>
                  </td>
                  {isAdmin && (
                    <td className="px-2 py-2 text-center">
                      <button onClick={() => removeRow(o)} disabled={deletingId === o.id}
                        aria-label={t('deleteRow')} title={t('deleteRow')}
                        className="text-muted hover:text-red-600 disabled:opacity-50">✕</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialog && <DeliveryOrderDialog order={dialog.order} onClose={() => setDialog(null)} />}
    </div>
  );
}
