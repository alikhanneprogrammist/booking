import {setRequestLocale} from 'next-intl/server';
import DeliveryView from '@/components/delivery/DeliveryView';
import {getDeliveryOrdersBetween} from '@/lib/queries';
import {currentUser} from '@/lib/auth-helpers';
import {addDays, weekStart} from '@/lib/calendar';

export const dynamic = 'force-dynamic';

const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;

// Вкладка «Доставка» — журнал внутренней доставки (как эксель «Свод недельной
// Внутренней Доставки» с листами по неделям): одна строка = один заказ.
export default async function DeliveryPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{w?: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  const sp = await searchParams;
  // Неделя ?w=YYYY-MM-DD (любой день недели); по умолчанию — текущая (Алматы).
  const anchor = WEEK_RE.test(sp.w ?? '') ? new Date(`${sp.w}T12:00:00`) : new Date();
  const from = weekStart(Number.isNaN(anchor.getTime()) ? new Date() : anchor);
  const to = addDays(from, 7);

  const [orders, prevOrders, user] = await Promise.all([
    getDeliveryOrdersBetween(from, to),
    getDeliveryOrdersBetween(addDays(from, -7), from),
    currentUser(),
  ]);

  // «Итого за прошлую неделю» — как строка сравнения в экселе.
  const prevTotals = {
    count: prevOrders.length,
    amount: prevOrders.reduce((s, o) => s + o.amount, 0),
    courier: prevOrders.reduce((s, o) => s + (o.courierCost ?? 0), 0),
  };

  return (
    <div className="h-screen overflow-auto">
      <DeliveryView
        orders={orders}
        weekStartIso={from.toISOString()}
        prevTotals={prevTotals}
        isAdmin={user?.role === 'ADMIN'}
      />
    </div>
  );
}
