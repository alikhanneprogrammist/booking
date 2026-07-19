import {setRequestLocale} from 'next-intl/server';
import PrepaymentsView from '@/components/prepayments/PrepaymentsView';
import {getBookingsPrepaidBetween, getArchivePrepaymentsBetween, getResources, getClients, getUsers} from '@/lib/queries';
import {toAlmaty, fromAlmaty} from '@/lib/time';

export const dynamic = 'force-dynamic';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// Вкладка «Предоплаты» — журнал бухгалтерии (как эксель с листами по месяцам):
// предоплата учитывается по дате получения денег (prepaidAt), а не по дате брони.
export default async function PrepaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{m?: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  const sp = await searchParams;
  // Месяц ?m=YYYY-MM; по умолчанию — текущий (Алматы). Прошлые месяцы без ограничений.
  const w = toAlmaty(new Date());
  const [year, month] = MONTH_RE.test(sp.m ?? '')
    ? (sp.m as string).split('-').map(Number)
    : [w.getFullYear(), w.getMonth() + 1];

  const from = fromAlmaty(new Date(year, month - 1, 1));
  const to = fromAlmaty(new Date(year, month, 1));

  const [bookings, archive, resources, clients, users] = await Promise.all([
    getBookingsPrepaidBetween(from, to),
    getArchivePrepaymentsBetween(from, to),
    getResources(),
    getClients(),
    getUsers(),
  ]);

  return (
    <div className="h-screen overflow-auto">
      <PrepaymentsView
        bookings={bookings}
        archive={archive}
        resources={resources}
        clients={clients}
        users={users}
        year={year}
        month={month}
      />
    </div>
  );
}
