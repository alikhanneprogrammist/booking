'use client';

import {HOUR_PX, HOURS, fmtHour, fmtWeekday, fmtDayNum, minutesFromDayStart, addDays} from '@/lib/calendar';
import type {MockResource, MockBooking, MockClient} from '@/lib/mock-data';
import BookingBlock from './BookingBlock';

interface Placed {
  b: MockBooking;
  vStart: Date;
  vEnd: Date;
  lane: number;
}

function packDay(items: {b: MockBooking; vStart: Date; vEnd: Date}[]): {placed: Placed[]; lanes: number} {
  const sorted = [...items].sort((a, b) => a.vStart.getTime() - b.vStart.getTime());
  const laneEnds: Date[] = [];
  const placed: Placed[] = [];
  for (const it of sorted) {
    let lane = laneEnds.findIndex((end) => end <= it.vStart);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(it.vEnd);
    } else {
      laneEnds[lane] = it.vEnd;
    }
    placed.push({...it, lane});
  }
  return {placed, lanes: Math.max(1, laneEnds.length)};
}

export default function WeekTimeline({
  weekStartDay, resources, bookings, clients, locale, now, onSlotClick, onBookingClick,
}: {
  weekStartDay: Date;
  resources: MockResource[];
  bookings: MockBooking[];
  clients: MockClient[];
  locale: string;
  now: Date;
  onSlotClick: (resourceId: string, slot: Date) => void;
  onBookingClick: (b: MockBooking) => void;
}) {
  const days = Array.from({length: 7}, (_, i) => addDays(weekStartDay, i));
  const resOf = (id: string) => resources.find((r) => r.id === id)!;

  function handleClick(dayStart: Date, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const minutes = ((e.clientY - rect.top) / HOUR_PX) * 60;
    const snapped = Math.max(0, Math.floor(minutes / 30) * 30);
    onSlotClick(resources[0].id, new Date(dayStart.getTime() + snapped * 60000));
  }

  return (
    <div className="flex h-full flex-col">
      {/* Заголовок дней */}
      <div className="flex border-b border-border">
        <div className="w-14 shrink-0" />
        {days.map((d) => {
          const isToday = now >= d && now < addDays(d, 1);
          return (
            <div key={d.getTime()} className={`flex-1 border-l border-border px-2 py-1.5 text-center ${isToday ? 'bg-subtle' : ''}`}>
              <div className="text-[11px] uppercase text-muted">{fmtWeekday(d, locale)}</div>
              <div className={`text-sm font-medium ${isToday ? 'text-foreground' : ''}`}>{fmtDayNum(d, locale)}</div>
            </div>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex" style={{height: 24 * HOUR_PX}}>
          <div className="relative w-14 shrink-0">
            {HOURS.map((h) => (
              <div key={h} className="absolute right-1 -translate-y-1/2 text-[10px] text-muted" style={{top: h * HOUR_PX}}>
                {fmtHour(h)}
              </div>
            ))}
          </div>

          {days.map((dayStart) => {
            const dayEnd = addDays(dayStart, 1);
            const items = bookings
              .filter((b) => b.status !== 'CANCELLED' && b.startAt < dayEnd && b.endAt > dayStart)
              .map((b) => ({
                b,
                vStart: b.startAt < dayStart ? dayStart : b.startAt,
                vEnd: b.endAt > dayEnd ? dayEnd : b.endAt,
              }));
            const {placed, lanes} = packDay(items);
            const showNow = now >= dayStart && now < dayEnd;
            const nowTop = (minutesFromDayStart(now, dayStart) / 60) * HOUR_PX;

            return (
              <div
                key={dayStart.getTime()}
                onClick={(e) => handleClick(dayStart, e)}
                className="relative flex-1 cursor-pointer border-l border-border"
              >
                {HOURS.map((h) => (
                  <div key={h} className="absolute left-0 right-0 border-t border-border/60" style={{top: h * HOUR_PX}} />
                ))}
                {showNow && <div className="absolute left-0 right-0 z-10 border-t-2 border-red-500" style={{top: nowTop}} />}
                {placed.map(({b, vStart, vEnd, lane}) => {
                  const top = (minutesFromDayStart(vStart, dayStart) / 60) * HOUR_PX;
                  const height = ((vEnd.getTime() - vStart.getTime()) / 3600_000) * HOUR_PX;
                  const w = 100 / lanes;
                  return (
                    <BookingBlock
                      key={b.id}
                      booking={b}
                      resource={resOf(b.resourceId)}
                      client={clients.find((c) => c.id === b.clientId)}
                      locale={locale}
                      showResource
                      style={{
                        top, height: Math.max(height, 18),
                        left: `calc(${lane * w}% + 2px)`,
                        width: `calc(${w}% - 4px)`,
                      }}
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
