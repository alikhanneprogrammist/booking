'use client';

import {useMemo} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Link, useRouter} from '@/i18n/navigation';
import {toAlmaty} from '@/lib/time';
import type {MockBooking, MockClient, MockResource, MockUser} from '@/lib/types';

// Журнал предоплат — колонки один в один как в эксель-файле бухгалтерии:
// Сумма п/о · Тип п/о · Имя гостя · VIP № · Дата оплаты · Дата посещения · Примечания · Ответственный.
export default function PrepaymentsView({
  bookings, resources, clients, users, year, month,
}: {
  bookings: MockBooking[];
  resources: MockResource[];
  clients: MockClient[];
  users: MockUser[];
  year: number;
  month: number; // 1–12
}) {
  const t = useTranslations('prepayments');
  const tpm = useTranslations('payment');
  const ts = useTranslations('status');
  const locale = useLocale();
  const router = useRouter();

  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const resById = useMemo(() => new Map(resources.map((r) => [r.id, r])), [resources]);
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const totalSum = bookings.reduce((s, b) => s + b.prepayment, 0);

  const money = (n: number) => `${Math.round(n).toLocaleString(locale)} ₸`;
  const fmtDate = (d: Date) =>
    toAlmaty(d).toLocaleDateString(locale === 'kk' ? 'kk-KZ' : 'ru-RU', {day: '2-digit', month: '2-digit', year: 'numeric'});

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString(
    locale === 'kk' ? 'kk-KZ' : 'ru-RU',
    {month: 'long', year: 'numeric'},
  );
  const shift = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    router.replace(`/prepayments?m=${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const name = (r?: MockResource) => (r ? (locale === 'kk' ? r.nameKk : r.nameRu) : '—');

  // Выгрузка месяца в .xlsx — те же колонки, что и таблица (и эксель бухгалтерии).
  async function downloadXlsx() {
    const XLSX = await import('xlsx');
    const header = [t('amount'), t('type'), t('guest'), t('resource'), t('paidDate'), t('visitDate'), t('note'), t('manager')];
    const rows = bookings.map((b) => {
      const cancelled = b.status === 'CANCELLED' || b.status === 'NO_SHOW';
      return [
        Math.round(b.prepayment),
        b.paymentMethod ? tpm(b.paymentMethod) : '—',
        clientById.get(b.clientId)?.name ?? '—',
        name(resById.get(b.resourceId)),
        b.prepaidAt ? fmtDate(b.prepaidAt) : '—',
        fmtDate(b.startAt),
        [b.comment, cancelled ? `(${ts(b.status)})` : ''].filter(Boolean).join(' ') || '—',
        (b.createdById && userById.get(b.createdById)?.name) || '—',
      ];
    });
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows, [Math.round(totalSum), t('monthTotal')]]);
    ws['!cols'] = header.map(() => ({wch: 18}));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, monthLabel);
    XLSX.writeFile(wb, `${t('fileName')}-${year}-${String(month).padStart(2, '0')}.xlsx`);
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
        {/* Навигация по месяцам — как листы «по 07.2026» в экселе */}
        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} aria-label="prev"
            className="rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-subtle">‹</button>
          <span className="min-w-36 px-2 text-center text-sm font-medium capitalize">{monthLabel}</span>
          <button onClick={() => shift(1)} aria-label="next"
            className="rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-subtle">›</button>
          <button onClick={downloadXlsx}
            className="ml-2 rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-subtle">
            ⬇ {t('download')}
          </button>
        </div>
      </div>

      {/* Итог месяца */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-sm">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted">{t('monthTotal')}</div>
          <div className="mt-0.5 text-lg font-semibold">{money(totalSum)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted">{t('count')}</div>
          <div className="mt-0.5 text-lg font-semibold">{bookings.length}</div>
        </div>
      </div>

      {bookings.length === 0 ? (
        <div className="mt-6 rounded-lg border border-border bg-card p-6 text-sm text-muted">{t('empty')}</div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2">{t('amount')}</th>
                <th className="px-3 py-2">{t('type')}</th>
                <th className="px-3 py-2">{t('guest')}</th>
                <th className="px-3 py-2">{t('resource')}</th>
                <th className="px-3 py-2">{t('paidDate')}</th>
                <th className="px-3 py-2">{t('visitDate')}</th>
                <th className="px-3 py-2">{t('note')}</th>
                <th className="px-3 py-2">{t('manager')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bookings.map((b) => {
                const client = clientById.get(b.clientId);
                const cancelled = b.status === 'CANCELLED' || b.status === 'NO_SHOW';
                return (
                  <tr key={b.id} className={cancelled ? 'text-muted' : ''}>
                    <td className="whitespace-nowrap px-3 py-2 font-medium">{money(b.prepayment)}</td>
                    <td className="whitespace-nowrap px-3 py-2">{b.paymentMethod ? tpm(b.paymentMethod) : '—'}</td>
                    <td className="max-w-40 truncate px-3 py-2">
                      {client ? (
                        <Link href={`/clients/${client.id}`} className="hover:underline">{client.name}</Link>
                      ) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{name(resById.get(b.resourceId))}</td>
                    <td className="whitespace-nowrap px-3 py-2">{b.prepaidAt ? fmtDate(b.prepaidAt) : '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2">{fmtDate(b.startAt)}</td>
                    <td className="max-w-48 truncate px-3 py-2" title={b.comment}>
                      {b.comment || '—'}
                      {cancelled && <span className="ml-1 text-xs">({ts(b.status)})</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{(b.createdById && userById.get(b.createdById)?.name) || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
