'use client';

import {useMemo, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Link, useRouter} from '@/i18n/navigation';
import {toAlmaty} from '@/lib/time';
import {clearBookingPrepayment, removeArchivePrepayment} from '@/lib/actions';
import AddPrepaymentDialog from './AddPrepaymentDialog';
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
  isArchive?: boolean; // строка журнала (архив/ручной ввод) — можно удалить админом
};

// Журнал предоплат — колонки один в один как в эксель-файле бухгалтерии:
// Сумма п/о · Тип п/о · Имя гостя · VIP № · Дата оплаты · Дата посещения · Примечания · Ответственный.
export default function PrepaymentsView({
  bookings, archive, resources, clients, users, year, month, isAdmin,
}: {
  bookings: MockBooking[];
  archive: ArchivePrepayment[];
  resources: MockResource[];
  clients: MockClient[];
  users: MockUser[];
  year: number;
  month: number; // 1–12
  isAdmin: boolean;
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
      isArchive: true,
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

  // Цвета типов предоплаты — фиксированные (Каспи — красный, Нал — зелёный, Банк — синий).
  const METHOD_CHIP: Record<PaymentMethod, string> = {
    KASPI: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-900',
    CASH: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-900',
    BANK: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900',
    CASH_KASPI: 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:ring-orange-900',
  };

  // Цвет ответственного — стабильный для каждого имени (хеш → палитра).
  const MANAGER_CHIPS = [
    'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:ring-sky-900',
    'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:ring-violet-900',
    'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-900',
    'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:ring-rose-900',
    'bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-950/40 dark:text-teal-400 dark:ring-teal-900',
    'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:ring-indigo-900',
    'bg-lime-50 text-lime-700 ring-lime-200 dark:bg-lime-950/40 dark:text-lime-400 dark:ring-lime-900',
    'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200 dark:bg-fuchsia-950/40 dark:text-fuchsia-400 dark:ring-fuchsia-900',
  ];
  const managerChip = (name: string) => {
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) % 997;
    return MANAGER_CHIPS[h % MANAGER_CHIPS.length];
  };
  const chipCls = 'inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ring-1';

  const [showAdd, setShowAdd] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Удаление строки журнала (только ADMIN): архив/ручной ввод удаляется целиком,
  // у строки-брони обнуляется предоплата (сама бронь остаётся в календаре).
  async function removeRow(r: JournalRow) {
    if (!window.confirm(r.isArchive ? t('deleteConfirm') : t('clearBookingConfirm'))) return;
    setDeletingId(r.id);
    try {
      await (r.isArchive ? removeArchivePrepayment(r.id) : clearBookingPrepayment(r.id));
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

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
          <button onClick={() => setShowAdd(true)}
            className="ml-1 rounded-md bg-primary px-2.5 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
            + {t('add')}
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
                {isAdmin && <th className="w-8 px-2 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const cancelled = isCancelled(r);
                return (
                  <tr key={r.id} className={cancelled ? 'text-muted' : ''}>
                    <td className="whitespace-nowrap px-3 py-2 font-medium">{money(r.amount)}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {r.method ? <span className={`${chipCls} ${METHOD_CHIP[r.method]}`}>{tpm(r.method)}</span> : '—'}
                    </td>
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
                    <td className="whitespace-nowrap px-3 py-2">
                      {r.manager ? <span className={`${chipCls} ${managerChip(r.manager)}`}>{r.manager}</span> : '—'}
                    </td>
                    {isAdmin && (
                      <td className="px-2 py-2 text-center">
                        <button onClick={() => removeRow(r)} disabled={deletingId === r.id}
                          aria-label={t('deleteRow')} title={t('deleteRow')}
                          className="text-muted hover:text-red-600 disabled:opacity-50">✕</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <AddPrepaymentDialog resources={resources} onClose={() => setShowAdd(false)} />}
    </div>
  );
}
