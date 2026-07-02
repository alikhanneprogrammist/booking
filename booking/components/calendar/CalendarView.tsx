'use client';

import {useEffect, useMemo, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {TIMEZONE} from '@/lib/time';
import {almatyDayStart, addDays, weekStart, fmtDayHeader, fmtDayNum, toLocalInput} from '@/lib/calendar';
import type {MockResource, MockAddon, MockClient, MockBooking} from '@/lib/mock-data';
import ResourceTimeline from './ResourceTimeline';
import WeekTimeline from './WeekTimeline';
import BookingDialog from './BookingDialog';

type Dialog =
  | {open: false}
  | {open: true; mode: 'create'; prefill: {resourceId: string; startAt: Date}}
  | {open: true; mode: 'edit'; booking: MockBooking};

export default function CalendarView({
  resources, addons, clients, bookings, viewDate, minBookingHours,
}: {
  resources: MockResource[];
  addons: MockAddon[];
  clients: MockClient[];
  bookings: MockBooking[];
  viewDate: Date;
  minBookingHours: number; // глобальный «пол» длительности из настроек заведения
}) {
  const locale = useLocale();
  const t = useTranslations('calendar');
  const tb = useTranslations('booking');
  const router = useRouter();

  const [mode, setMode] = useState<'day' | 'week'>('day');
  const [dialog, setDialog] = useState<Dialog>({open: false});
  const [now, setNow] = useState<Date>(() => new Date());

  // День в URL: сервер отдаёт брони только вокруг просматриваемой недели.
  const setViewDate = (d: Date) =>
    router.replace(`/calendar?d=${toLocalInput(almatyDayStart(d)).slice(0, 10)}`);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const ws = useMemo(() => weekStart(viewDate), [viewDate]);
  const step = mode === 'day' ? 1 : 7;

  const label =
    mode === 'day'
      ? fmtDayHeader(viewDate, locale)
      : `${fmtDayNum(ws, locale)}–${fmtDayNum(addDays(ws, 6), locale)} ` +
        new Intl.DateTimeFormat(locale, {timeZone: TIMEZONE, month: 'long'}).format(addDays(ws, 6));

  // После успешной серверной мутации — закрываем диалог и перечитываем данные.
  function saved() {
    setDialog({open: false});
    router.refresh();
  }

  const openCreate = (resourceId: string, startAt: Date) =>
    setDialog({open: true, mode: 'create', prefill: {resourceId, startAt}});
  const openEdit = (booking: MockBooking) => setDialog({open: true, mode: 'edit', booking});

  const btn = 'rounded-md border border-border px-2.5 py-1.5 text-sm font-medium hover:bg-subtle';

  return (
    <div className="flex h-full flex-col">
      {/* Шапка */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold tracking-tight">{t('title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className={btn} onClick={() => setViewDate(almatyDayStart(new Date()))}>{t('today')}</button>
          <div className="flex items-center">
            <button className={`${btn} rounded-r-none`} onClick={() => setViewDate(addDays(viewDate, -step))}>‹</button>
            <button className={`${btn} rounded-l-none border-l-0`} onClick={() => setViewDate(addDays(viewDate, step))}>›</button>
          </div>
          <span className="min-w-40 text-sm font-medium capitalize">{label}</span>
          <div className="inline-flex rounded-md border border-border p-0.5 text-sm">
            <button
              className={`rounded px-3 py-1 font-medium ${mode === 'day' ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-foreground'}`}
              onClick={() => setMode('day')}
            >
              {t('day')}
            </button>
            <button
              className={`rounded px-3 py-1 font-medium ${mode === 'week' ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-foreground'}`}
              onClick={() => setMode('week')}
            >
              {t('week')}
            </button>
          </div>
          <button
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            onClick={() => openCreate(resources[0].id, new Date(viewDate.getTime() + 20 * 3600_000))}
          >
            + {tb('createTitle')}
          </button>
        </div>
      </header>

      {/* Таймлайн */}
      <div className="min-h-0 flex-1">
        {mode === 'day' ? (
          <ResourceTimeline
            dayStart={viewDate}
            resources={resources}
            bookings={bookings}
            clients={clients}
            addons={addons}
            locale={locale}
            now={now}
            onSlotClick={openCreate}
            onBookingClick={openEdit}
          />
        ) : (
          <WeekTimeline
            weekStartDay={ws}
            resources={resources}
            bookings={bookings}
            clients={clients}
            addons={addons}
            locale={locale}
            now={now}
            onSlotClick={openCreate}
            onBookingClick={openEdit}
          />
        )}
      </div>

      {dialog.open && (
        <BookingDialog
          mode={dialog.mode}
          booking={dialog.mode === 'edit' ? dialog.booking : undefined}
          prefill={dialog.mode === 'create' ? dialog.prefill : undefined}
          resources={resources}
          addons={addons}
          clients={clients}
          bookings={bookings}
          locale={locale}
          minBookingHours={minBookingHours}
          onSaved={saved}
          onClose={() => setDialog({open: false})}
        />
      )}
    </div>
  );
}
