'use client';

import {useEffect, useRef} from 'react';
import {useTranslations} from 'next-intl';
import {
  HOUR_PX, fmtHour, minutesFromDayStart, addDays,
} from '@/lib/calendar';
import type {MockResource, MockBooking, MockClient, MockAddon} from '@/lib/types';
import BookingBlock from './BookingBlock';

const KINDS = ['COMPLEX', 'KARAOKE'] as const;

export default function ResourceTimeline({
  dayStart, resources, bookings, clients, addons, locale, now, onSlotClick, onBookingClick,
}: {
  dayStart: Date;
  resources: MockResource[];
  bookings: MockBooking[];
  clients: MockClient[];
  addons: MockAddon[];
  locale: string;
  now: Date;
  onSlotClick: (resourceId: string, slot: Date) => void;
  onBookingClick: (b: MockBooking) => void;
}) {
  const tg = useTranslations('groups');
  const dayEnd = addDays(dayStart, 1);
  const showNow = now >= dayStart && now < dayEnd;
  const nowTop = (minutesFromDayStart(now, dayStart) / 60) * HOUR_PX;

  // Сетка строго 00:00–24:00: часть брони за полночь показывается в начале следующего дня.
  const hours = Array.from({length: 24}, (_, i) => i);

  // Рисуем всё видимое в сутках [dayStart, dayEnd), включая «хвосты» броней с прошлого дня.
  const dayBookings = bookings.filter((b) => b.startAt < dayEnd && b.endAt > dayStart);

  const name = (r: MockResource) => (locale === 'kk' ? r.nameKk : r.nameRu);
  const groups = KINDS.map((k) => ({k, items: resources.filter((r) => r.kind === k)})).filter((g) => g.items.length);
  // Колонки строго в порядке групп шапки (комплексы, затем караоке): если админ
  // перемешал sortOrder разных типов, заголовки групп иначе съедут с колонок.
  const cols = groups.flatMap((g) => g.items);

  function handleColumnClick(resourceId: string, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const minutes = ((e.clientY - rect.top) / HOUR_PX) * 60;
    const snapped = Math.max(0, Math.floor(minutes / 30) * 30);
    onSlotClick(resourceId, new Date(dayStart.getTime() + snapped * 60000));
  }

  // Авто-скролл при смене дня: к «сейчас» (если сегодня) или к 10:00 — чтобы не упираться в 00:00.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = showNow ? Math.max(0, nowTop - 120) : 10 * HOUR_PX;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayStart]);

  return (
    // Один скролл-контейнер на шапку и тело: колонки всегда одной ширины (скроллбар не сдвигает тело).
    <div ref={scrollRef} className="h-full overflow-auto">
      {/* Минимум ~96px на колонку: при многих объектах появляется гор. скролл вместо каши */}
      <div style={{minWidth: 56 + resources.length * 96}}>
      {/* Заголовок: группы + объекты (липкий, поверх броней и линии «сейчас») */}
      <div className="sticky top-0 z-20 border-b border-border bg-background">
        <div className="flex">
          <div className="w-14 shrink-0" />
          {groups.map((g) => (
            <div key={g.k} style={{flexGrow: g.items.length, flexBasis: 0}}
              className="min-w-0 truncate border-l border-border px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted">
              {tg(g.k)}
            </div>
          ))}
        </div>
        {/* min-w-0 на ячейках: без него flex не ужимает ячейку уже полного названия,
            шапка становится шире тела и колонки съезжают относительно броней */}
        <div className="flex">
          <div className="w-14 shrink-0" />
          {cols.map((r) => (
            <div key={r.id} className="min-w-0 flex-1 border-l border-border px-2 py-1.5">
              <div className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{backgroundColor: r.color}} />
                <span className="truncate" title={name(r)}>{name(r)}</span>
              </div>
              <div className="truncate text-[11px] text-muted">до {r.capacity} чел.</div>
            </div>
          ))}
        </div>
      </div>

      {/* Тело: сетка часов + колонки */}
      <div className="flex" style={{height: 24 * HOUR_PX}}>
          {/* Часовая шкала */}
          <div className="relative w-14 shrink-0">
            {hours.map((h) => (
              <div
                key={h}
                className="absolute right-1 -translate-y-1/2 text-[10px] text-muted"
                style={{top: h * HOUR_PX}}
              >
                {fmtHour(h)}
              </div>
            ))}
          </div>

          {cols.map((r) => (
            <div
              key={r.id}
              onClick={(e) => handleColumnClick(r.id, e)}
              className="relative flex-1 cursor-pointer border-l border-border"
            >
              {/* Часовые линии */}
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute left-0 right-0 border-t border-border/60"
                  style={{top: h * HOUR_PX}}
                />
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
                    addons={addons}
                    locale={locale}
                    style={{top, height: Math.max(height, 18), left: 4, right: 4}}
                    clipped={b.endAt > dayEnd}
                    onClick={() => onBookingClick(b)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
