'use client';

import {useTranslations} from 'next-intl';
import {
  HOUR_PX, HOURS, fmtHour, minutesFromDayStart, addDays,
} from '@/lib/calendar';
import type {MockResource, MockBooking, MockClient} from '@/lib/mock-data';
import BookingBlock from './BookingBlock';

const KINDS = ['COMPLEX', 'KARAOKE'] as const;

export default function ResourceTimeline({
  dayStart, resources, bookings, clients, locale, now, onSlotClick, onBookingClick,
}: {
  dayStart: Date;
  resources: MockResource[];
  bookings: MockBooking[];
  clients: MockClient[];
  locale: string;
  now: Date;
  onSlotClick: (resourceId: string, slot: Date) => void;
  onBookingClick: (b: MockBooking) => void;
}) {
  const tg = useTranslations('groups');
  const dayEnd = addDays(dayStart, 1);
  const showNow = now >= dayStart && now < dayEnd;
  const nowTop = (minutesFromDayStart(now, dayStart) / 60) * HOUR_PX;

  const name = (r: MockResource) => (locale === 'kk' ? r.nameKk : r.nameRu);
  const groups = KINDS.map((k) => ({k, items: resources.filter((r) => r.kind === k)})).filter((g) => g.items.length);

  function handleColumnClick(resourceId: string, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const minutes = ((e.clientY - rect.top) / HOUR_PX) * 60;
    const snapped = Math.max(0, Math.floor(minutes / 30) * 30);
    onSlotClick(resourceId, new Date(dayStart.getTime() + snapped * 60000));
  }

  return (
    <div className="flex h-full flex-col">
      {/* Заголовок: группы + объекты */}
      <div className="border-b border-border">
        <div className="flex">
          <div className="w-14 shrink-0" />
          {groups.map((g) => (
            <div key={g.k} style={{flexGrow: g.items.length, flexBasis: 0}}
              className="border-l border-border px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted">
              {tg(g.k)}
            </div>
          ))}
        </div>
        <div className="flex">
          <div className="w-14 shrink-0" />
          {resources.map((r) => (
            <div key={r.id} className="flex-1 border-l border-border px-2 py-1.5">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <span className="h-2 w-2 rounded-full" style={{backgroundColor: r.color}} />
                <span className="truncate">{name(r)}</span>
              </div>
              <div className="text-[11px] text-muted">до {r.capacity} чел.</div>
            </div>
          ))}
        </div>
      </div>

      {/* Тело: сетка часов + колонки */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex" style={{height: 24 * HOUR_PX}}>
          {/* Часовая шкала */}
          <div className="relative w-14 shrink-0">
            {HOURS.map((h) => (
              <div key={h} className="absolute right-1 -translate-y-1/2 text-[10px] text-muted" style={{top: h * HOUR_PX}}>
                {fmtHour(h)}
              </div>
            ))}
          </div>

          {resources.map((r) => {
            const dayBookings = bookings.filter(
              (b) => b.startAt < dayEnd && b.endAt > dayStart,
            );
            return (
              <div
                key={r.id}
                onClick={(e) => handleColumnClick(r.id, e)}
                className="relative flex-1 cursor-pointer border-l border-border"
              >
                {/* Часовые линии */}
                {HOURS.map((h) => (
                  <div key={h} className="absolute left-0 right-0 border-t border-border/60" style={{top: h * HOUR_PX}} />
                ))}
                {/* Линия «сейчас» */}
                {showNow && (
                  <div className="absolute left-0 right-0 z-10 border-t-2 border-red-500" style={{top: nowTop}}>
                    <span className="absolute -top-1 -left-1 h-2 w-2 rounded-full bg-red-500" />
                  </div>
                )}
                {/* Брони этого объекта */}
                {dayBookings.filter((b) => b.resourceId === r.id).map((b) => {
                  const vStart = b.startAt < dayStart ? dayStart : b.startAt;
                  const vEnd = b.endAt > dayEnd ? dayEnd : b.endAt;
                  const top = (minutesFromDayStart(vStart, dayStart) / 60) * HOUR_PX;
                  const height = ((vEnd.getTime() - vStart.getTime()) / 3600_000) * HOUR_PX;
                  return (
                    <BookingBlock
                      key={b.id}
                      booking={b}
                      resource={r}
                      client={clients.find((c) => c.id === b.clientId)}
                      locale={locale}
                      style={{top, height: Math.max(height, 18), left: 4, right: 4}}
                      onClick={() => onBookingClick(b)}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
