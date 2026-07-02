'use client';

import type {CSSProperties} from 'react';
import {useTranslations} from 'next-intl';
import {fmtTime} from '@/lib/calendar';
import type {MockBooking, MockResource, MockClient} from '@/lib/mock-data';

/** Цветной блок брони на таймлайне (ТЗ §4.4): цвет — от объекта, бэйдж — статус. */
export default function BookingBlock({
  booking,
  resource,
  client,
  locale,
  style,
  showResource = false,
  clipped = false,
  onClick,
}: {
  booking: MockBooking;
  resource: MockResource;
  client?: MockClient;
  locale: string;
  style: CSSProperties;
  showResource?: boolean;
  clipped?: boolean; // бронь длиннее видимой сетки — низ блока обрезан
  onClick: () => void;
}) {
  const tc = useTranslations('calendar');
  const cancelled = booking.status === 'CANCELLED';
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        ...style,
        borderLeftColor: resource.color,
        backgroundColor: resource.color + '22',
      }}
      className={`absolute overflow-hidden rounded-md border border-border border-l-[3px] px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm transition-shadow hover:shadow ${
        cancelled ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-center gap-1 font-medium">
        <span
          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
          style={{backgroundColor: resource.color}}
        />
        <span className="truncate">
          {fmtTime(booking.startAt, locale)}–{fmtTime(booking.endAt, locale)}
        </span>
      </div>
      {showResource && (
        <div className="truncate font-medium" style={{color: resource.color}}>
          {locale === 'kk' ? resource.nameKk : resource.nameRu}
        </div>
      )}
      <div className="truncate text-muted">{client?.name ?? '—'}</div>
      {clipped && (
        <div
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-card/90 to-transparent px-1 text-center text-[9px] font-medium text-muted"
          title={`${fmtTime(booking.startAt, locale)}–${fmtTime(booking.endAt, locale)}`}
        >
          {tc('continues')} ↓
        </div>
      )}
    </button>
  );
}
