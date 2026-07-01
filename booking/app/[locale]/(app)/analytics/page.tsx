import {setRequestLocale} from 'next-intl/server';
import AnalyticsView from '@/components/analytics/AnalyticsView';
import {getBookings, getResources, getClients, getAddons} from '@/lib/queries';
import {toAlmaty} from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  const [bookings, resources, clients, addons] = await Promise.all([
    getBookings(),
    getResources(),
    getClients(),
    getAddons(),
  ]);

  const w = toAlmaty(new Date());
  const today = {year: w.getFullYear(), month: w.getMonth(), day: w.getDate()};

  return (
    <div className="h-screen overflow-auto">
      <AnalyticsView
        bookings={bookings}
        resources={resources}
        clients={clients}
        addons={addons}
        today={today}
        nowMs={Date.now()}
      />
    </div>
  );
}
