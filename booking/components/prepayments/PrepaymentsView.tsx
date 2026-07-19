'use client';

import {useMemo} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Link, useRouter} from '@/i18n/navigation';
import {toAlmaty} from '@/lib/time';
import type {
  ArchivePrepayment, BookingStatus, MockBooking, MockClient, MockResource, MockUser, PaymentMethod,
} from '@/lib/types';

// Единая строка журнала: бронь с предоплатой (ручной ввод) или строка архива
// (разовый импорт из экселя — clientId нет, зал текстом как в экселе).
type JournalRow = {
  id: string;
  amount: number;
  method?: PaymentMethod;
  guest: string;
  clientId?: string;
  resourceLabel: string;
  paidAt?: Date | null;
  visitAt: Date;
  note?: string;
  manager?: string;
  status?: BookingStatus;
};

// Журнал предоплат — колонки один в один как в эксель-файле бухгалтерии:
// Сумма п/о · Тип п/о · Имя гостя · VIP № · Дата оплаты · Дата посещения · Примечания · Ответственный.
export default function PrepaymentsView({
  bookings, archive, resources, clients, users, year, month,
}: {
  bookings: MockBooking[];
  archive: ArchivePrepayment[];
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

  const name = (r?: MockResource) => (r ? (locale === 'kk' ? r.nameKk : r.nameRu) : '—');

  // Объединяем ручные предоплаты (брони) и архив, сортируем по дате оплаты.
  const rows = useMemo<JournalRow[]>(() => {
    const fromBookings = bookings.map<JournalRow>((b) => ({
      id: b.id,
      amount: b.prepayment,
      method: b.paymentMethod,
      guest: clientById.get(b.clientId)?.name ?? '—',
      clientId: b.clientId,
      resourceLabel: name(resById.get(b.resourceId)),
      paidAt: b.prepaidAt,
      visitAt: b.startAt,
      note: b.comment,
      manager: (b.createdById && userById.get(b.createdById)?.name) || undefined,
      status: b.status,
    }));
    const fromArchive = archive.map<JournalRow>((a) => ({
      id: a.id,
      amount: a.amount,
      method: a.paymentMethod,
      guest: a.guest,
      resourceLabel: a.resourceLabel || '—',
      paidAt: a.paidAt,
      visitAt: a.visitAt,
      note: a.note,
      manager: a.manager,
    }));
    return [...fromBookings, ...fromArchive].sort(
      (a, b) => (a.paidAt?.getTime() ?? 0) - (b.paidAt?.getTime() ?? 0),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, archive, clientById, resById, userById, locale]);

  const totalSum = rows.reduce((s, r) => s + r.amount, 0);

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

  const isCancelled = (r: JournalRow) => r.status === 'CANCELLED' || r.status === 'NO_SHOW';

  // Выгрузка месяца в .xlsx — те же колонки, что и таблица (и эксель бухгалтерии).
  async function downloadXlsx() {
    const XLSX = await import('xlsx');
    const header = [t('amount'), t('type'), t('guest'), t('resource'), t('paidDate'), t('visitDate'), t('note'), t('manager')];
    const dataRows = rows.map((r) => [
      Math.round(r.amount),
      r.method ? tpm(r.method) : '—',
      r.guest,
      r.resourceLabel,
      r.paidAt ? fmtDate(r.paidAt) : '—',
      fmtDate(r.visitAt),
      [r.note, isCancelled(r) ? `(${ts(r.status!)})` : ''].filter(Boolean).join(' ') || '—',
      r.manager || '—',
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows, [Math.round(totalSum), t('monthTotal')]]);
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
          <div className="mt-0.5 text-lg font-semibold">{rows.length}</div>
        </div>
      </div>

      {rows.length === 0 ? (
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
              {rows.map((r) => {
                const cancelled = isCancelled(r);
                return (
                  <tr key={r.id} className={cancelled ? 'text-muted' : ''}>
                    <td className="whitespace-nowrap px-3 py-2 font-medium">{money(r.amount)}</td>
                    <td className="whitespace-nowrap px-3 py-2">{r.method ? tpm(r.method) : '—'}</td>
                    <td className="max-w-40 truncate px-3 py-2" title={r.guest}>
                      {r.clientId && clientById.has(r.clientId) ? (
                        <Link href={`/clients/${r.clientId}`} className="hover:underline">{r.guest}</Link>
                      ) : r.guest}
                    </td>
                    <td className="max-w-32 truncate whitespace-nowrap px-3 py-2" title={r.resourceLabel}>{r.resourceLabel}</td>
                    <td className="whitespace-nowrap px-3 py-2">{r.paidAt ? fmtDate(r.paidAt) : '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2">{fmtDate(r.visitAt)}</td>
                    <td className="max-w-48 truncate px-3 py-2" title={r.note}>
                      {r.note || '—'}
                      {cancelled && <span className="ml-1 text-xs">({ts(r.status!)})</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{r.manager || '—'}</td>
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
