import {setRequestLocale} from 'next-intl/server';
import AnalyticsView, {type Preset} from '@/components/analytics/AnalyticsView';
import {getBookingsStartingBetween, getResources, getClients, getAddons} from '@/lib/queries';
import {toAlmaty, fromAlmaty} from '@/lib/time';
import {almatyDayStart, addDays} from '@/lib/calendar';

export const dynamic = 'force-dynamic';

const PRESETS: Preset[] = ['today', 'week', 'month', '30d', 'all'];
// Скользящие окна «последние N дней» (вкл. сегодня).
const ROLLING: Partial<Record<Preset, number>> = {today: 1, week: 7, '30d': 30};

export default async function AnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{p?: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  const {p} = await searchParams;
  const preset: Preset = PRESETS.includes(p as Preset) ? (p as Preset) : 'month';

  // Границы периода (Алматы) считаем на сервере и выбираем из БД только его —
  // вся история не гоняется в браузер ради «сегодня».
  const now = new Date();
  let from: Date | undefined;
  let to: Date | undefined;
  if (preset === 'month') {
    const w = toAlmaty(now);
    from = fromAlmaty(new Date(w.getFullYear(), w.getMonth(), 1));
    to = fromAlmaty(new Date(w.getFullYear(), w.getMonth() + 1, 1));
  } else if (preset !== 'all') {
    const days = ROLLING[preset] ?? 30;
    to = addDays(almatyDayStart(now), 1);
    from = almatyDayStart(addDays(now, -(days - 1)));
  }

  const [bookings, resources, clients, addons] = await Promise.all([
    getBookingsStartingBetween(from, to),
    getResources(),
    getClients(),
    getAddons(),
  ]);

  return (
    <div className="h-screen overflow-auto">
      <AnalyticsView
        bookings={bookings}
        resources={resources}
        clients={clients}
        addons={addons}
        preset={preset}
      />
    </div>
  );
}
