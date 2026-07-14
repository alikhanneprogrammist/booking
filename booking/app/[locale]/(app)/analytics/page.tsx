import {setRequestLocale} from 'next-intl/server';
import AnalyticsView, {type Preset} from '@/components/analytics/AnalyticsView';
import {getBookingsStartingBetween, getBookingsPrepaidBetween, getResources, getClients, getAddons} from '@/lib/queries';
import {toAlmaty, fromAlmaty} from '@/lib/time';
import {almatyDayStart, addDays, fromLocalInput, toLocalInput} from '@/lib/calendar';

export const dynamic = 'force-dynamic';

const PRESETS: Preset[] = ['today', 'week', 'month', '30d', 'custom'];
// Скользящие окна «последние N дней» (вкл. сегодня).
const ROLLING: Partial<Record<Preset, number>> = {today: 1, week: 7, '30d': 30};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function AnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{p?: string; from?: string; to?: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  const sp = await searchParams;
  let preset: Preset = PRESETS.includes(sp.p as Preset) ? (sp.p as Preset) : 'month';

  // Границы периода (Алматы) считаем на сервере и выбираем из БД только его.
  // Каждый пресет ограничен — неограниченной выборки «за всё время» больше нет.
  const now = new Date();
  let from: Date;
  let to: Date;
  if (preset === 'custom' && DATE_RE.test(sp.from ?? '') && DATE_RE.test(sp.to ?? '')) {
    from = almatyDayStart(fromLocalInput(`${sp.from}T00:00`));
    to = addDays(almatyDayStart(fromLocalInput(`${sp.to}T00:00`)), 1); // конец включительно
    if (to <= from) to = addDays(from, 1); // защита от перепутанных дат
  } else if (preset === 'month' || preset === 'custom') {
    preset = 'month'; // custom без валидных дат → текущий месяц
    const w = toAlmaty(now);
    from = fromAlmaty(new Date(w.getFullYear(), w.getMonth(), 1));
    to = fromAlmaty(new Date(w.getFullYear(), w.getMonth() + 1, 1));
  } else {
    const days = ROLLING[preset] ?? 30;
    to = addDays(almatyDayStart(now), 1);
    from = almatyDayStart(addDays(now, -(days - 1)));
  }

  const [bookingsRaw, prepaid, resources, clients, addons] = await Promise.all([
    getBookingsStartingBetween(from, to),
    getBookingsPrepaidBetween(from, to), // деньги по дате получения (вкл. импортированную историю)
    getResources(),
    getClients(),
    getAddons(),
  ]);

  // Импортированные из эксель-журнала записи (нулевая длительность [X, X)) — не брони,
  // а строки денежной истории: в подсчёте броней/гостей/чека они бы искажали цифры.
  const bookings = bookingsRaw.filter((b) => b.endAt.getTime() > b.startAt.getTime());

  // Активный диапазон для полей выбора периода (конец — включительно).
  const fmt = (d: Date) => toLocalInput(d).slice(0, 10);

  return (
    <div className="h-screen overflow-auto">
      <AnalyticsView
        bookings={bookings}
        prepaid={prepaid}
        resources={resources}
        clients={clients}
        addons={addons}
        preset={preset}
        rangeFrom={fmt(from)}
        rangeTo={fmt(addDays(to, -1))}
      />
    </div>
  );
}
