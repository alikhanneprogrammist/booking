import {setRequestLocale} from 'next-intl/server';
import CalendarView from '@/components/calendar/CalendarView';
import {getResources, getAddons, getClients, getBookings} from '@/lib/queries';

// Живые данные из БД на каждый запрос (и без обращения к БД на этапе сборки).
export const dynamic = 'force-dynamic';

export default async function CalendarPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  const [resources, addons, clients, bookings] = await Promise.all([
    getResources(),
    getAddons(),
    getClients(),
    getBookings(),
  ]);

  return (
    <div className="h-screen">
      <CalendarView
        resources={resources}
        addons={addons}
        clients={clients}
        bookings={bookings}
      />
    </div>
  );
}
