'use client';

import {useEffect, useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import {
  HOUR_PX, fmtHour, minutesFromDayStart, addDays, SHIFT_START_HOUR,
} from '@/lib/calendar';
import type {MockResource, MockBooking, MockClient, MockAddon} from '@/lib/types';
import BookingBlock from './BookingBlock';

const KINDS = ['COMPLEX', 'KARAOKE'] as const;

export default function ResourceTimeline({
  dayStart, resources, bookings, clients, addons, locale, now, minBookingHours, onSlotClick, onBookingClick, onResize,
}: {
  dayStart: Date;
  resources: MockResource[];
  bookings: MockBooking[];
  clients: MockClient[];
  addons: MockAddon[];
  locale: string;
  now: Date;
  minBookingHours: number;
  onSlotClick: (resourceId: string, slot: Date) => void;
  onBookingClick: (b: MockBooking) => void;
  onResize: (id: string, endAt: Date) => Promise<{ok: boolean; error?: string; message?: string}>;
}) {
  const tg = useTranslations('groups');
  const tb = useTranslations('booking');
  const dayEnd = addDays(dayStart, 1);
  const showNow = now >= dayStart && now < dayEnd;
  const nowTop = (minutesFromDayStart(now, dayStart) / 60) * HOUR_PX;

  // Сетка смены 10:00→10:00: i-я строка = стеночный час (i+10)%24; ночная часть
  // брони показывается внизу ТОЙ ЖЕ смены, а не в начале следующего дня.
  const hours = Array.from({length: 24}, (_, i) => (i + SHIFT_START_HOUR) % 24);

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

  // ── Растягивание брони за нижний край (шаг 30 мин) ──────────────────────
  const [resizing, setResizing] = useState<{bookingId: string; previewEnd: Date; saving: boolean} | null>(null);
  // Свежие данные с сервера пришли — превью больше не нужно.
  useEffect(() => setResizing(null), [bookings]);

  function startResize(b: MockBooking, r: MockResource, e: React.PointerEvent<HTMLDivElement>) {
    if (resizing?.saving) return;
    e.stopPropagation();
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);

    const startY = e.clientY;
    const origEndMin = minutesFromDayStart(b.endAt, dayStart);
    const startMin = minutesFromDayStart(b.startAt, dayStart);
    // Нижняя граница: минимум длительности для почасового тарифа, иначе полчаса.
    const minHours = b.tariff === 'HOURLY' ? Math.max(r.minHours, minBookingHours) : 0.5;
    const minMin = startMin + minHours * 60;
    // Верхняя граница: конец суток смены и начало следующей брони этого объекта.
    const nextStarts = bookings
      .filter((x) => x.resourceId === b.resourceId && x.id !== b.id && x.startAt >= b.endAt)
      .map((x) => minutesFromDayStart(x.startAt, dayStart));
    const maxMin = Math.min(24 * 60, ...nextStarts);

    let currentEnd = b.endAt;
    const detach = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
    };
    const move = (ev: PointerEvent) => {
      const deltaMin = ((ev.clientY - startY) / HOUR_PX) * 60;
      const snapped = Math.round((origEndMin + deltaMin) / 30) * 30;
      const clamped = Math.min(maxMin, Math.max(minMin, snapped));
      currentEnd = new Date(dayStart.getTime() + clamped * 60000);
      setResizing({bookingId: b.id, previewEnd: currentEnd, saving: false});
    };
    const up = async () => {
      detach();
      if (currentEnd.getTime() === b.endAt.getTime()) {
        setResizing(null);
        return;
      }
      setResizing({bookingId: b.id, previewEnd: currentEnd, saving: true});
      const res = await onResize(b.id, currentEnd);
      if (!res.ok) {
        const known: Record<string, string> = {
          OVERLAP: tb('occupied'), INVALID_RANGE: tb('invalidRange'), MIN_DURATION: tb('minDuration'),
        };
        alert(known[res.error ?? ''] ?? res.message ?? res.error);
        setResizing(null);
      }
      // При успехе превью держим до прихода свежего bookings (сброс в useEffect выше).
    };
    const cancel = () => {
      detach();
      setResizing(null);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
    setResizing({bookingId: b.id, previewEnd: b.endAt, saving: false});
  }

  // Авто-скролл при смене дня: к «сейчас» (если сегодня) или к началу смены (10:00).
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = showNow ? Math.max(0, nowTop - 120) : 0;
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
            {hours.map((h, i) => (
              <div
                key={h}
                className="absolute right-1 -translate-y-1/2 text-[10px] text-muted"
                style={{top: i * HOUR_PX}}
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
              {hours.map((h, i) => (
                <div
                  key={h}
                  className="absolute left-0 right-0 border-t border-border/60"
                  style={{top: i * HOUR_PX}}
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
                // Во время растягивания рисуем бронь с предварительным endAt.
                const bEff = resizing?.bookingId === b.id ? {...b, endAt: resizing.previewEnd} : b;
                const vStart = bEff.startAt < dayStart ? dayStart : bEff.startAt;
                const vEnd = bEff.endAt > dayEnd ? dayEnd : bEff.endAt;
                const top = (minutesFromDayStart(vStart, dayStart) / 60) * HOUR_PX;
                const height = Math.max(((vEnd.getTime() - vStart.getTime()) / 3600_000) * HOUR_PX, 18);
                const clipped = bEff.endAt > dayEnd;
                return (
                  <div key={b.id} className="contents">
                    <BookingBlock
                      booking={bEff}
                      resource={r}
                      client={clients.find((c) => c.id === b.clientId)}
                      addons={addons}
                      locale={locale}
                      style={{top, height, left: 4, right: 4}}
                      clipped={clipped}
                      onClick={() => onBookingClick(b)}
                    />
                    {/* Ручка растягивания — сиблинг (корень блока — <button>, вложить нельзя).
                        У обрезанных снизу броней («продолжается ↓») ручки нет. */}
                    {!clipped && (
                      <div
                        className="absolute z-10 cursor-ns-resize rounded-b-md hover:bg-black/15 dark:hover:bg-white/25"
                        style={{top: top + height - 7, height: 10, left: 4, right: 4, touchAction: 'none'}}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => startResize(b, r, e)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
