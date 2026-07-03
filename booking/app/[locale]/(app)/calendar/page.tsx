import {setRequestLocale} from 'next-intl/server';
import CalendarView from '@/components/calendar/CalendarView';
import {getResources, getAddons, getClients, getBookingsBetween, getSettings} from '@/lib/queries';
import {almatyDayStart, weekStart, addDays, fromLocalInput} from '@/lib/calendar';

// Живые данные из БД на каждый запрос (и без обращения к БД на этапе сборки).
export const dynamic = 'force-dynamic';

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{d?: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  // Просматриваемый день из URL (?d=YYYY-MM-DD, стеночная дата Алматы); мусор → сегодня.
  const {d} = await searchParams;
  const explicitDate = Boolean(d && /^\d{4}-\d{2}-\d{2}$/.test(d));
  const parsed = explicitDate ? fromLocalInput(`${d}T00:00`) : new Date();
  const viewDate = almatyDayStart(Number.isNaN(parsed.getTime()) ? new Date() : parsed);

  // Окно выборки: неделя просматриваемого дня + сутки запаса, чтобы покрыть
  // «хвосты» ночных броней и продлённую сетку дня (до +32 ч за последний день недели).
  const ws = weekStart(viewDate);
  const [resources, addons, clients, bookings, settings] = await Promise.all([
    getResources(),
    getAddons(),
    getClients(),
    getBookingsBetween(ws, addDays(ws, 8)),
    getSettings(),
  ]);

  return (
    <div className="h-screen">
      <CalendarView
        resources={resources}
        addons={addons}
        clients={clients}
        bookings={bookings}
        viewDate={viewDate}
        explicitDate={explicitDate}
        minBookingHours={settings.minBookingHours}
      />
    </div>
  );
}
