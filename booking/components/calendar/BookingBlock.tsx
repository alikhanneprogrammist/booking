'use client';

import type {CSSProperties} from 'react';
import {useTranslations} from 'next-intl';
import {fmtTime} from '@/lib/calendar';
import {STATUS_BG} from './StatusBadge';
import type {MockBooking, MockResource, MockClient, MockAddon} from '@/lib/types';

/** Цветной блок брони на таймлайне (ТЗ §4.4): цвет — от объекта, бэйдж — статус. */
export default function BookingBlock({
  booking,
  resource,
  client,
  addons,
  locale,
  style,
  showResource = false,
  clipped = false,
  onClick,
}: {
  booking: MockBooking;
  resource: MockResource;
  client?: MockClient;
  addons: MockAddon[]; // каталог доп-услуг — для имён предзаказа
  locale: string;
  style: CSSProperties;
  showResource?: boolean;
  clipped?: boolean; // бронь длиннее видимой сетки — низ блока обрезан
  onClick: () => void;
}) {
  const tc = useTranslations('calendar');
  const cancelled = booking.status === 'CANCELLED';

  // Предзаказ: «Кальян ×2 · СПА» (локализованные имена из каталога).
  const aName = (id: string) => {
    const a = addons.find((x) => x.id === id);
    return a ? (locale === 'kk' ? a.nameKk : a.nameRu) : id;
  };
  const preorder = booking.addons
    .map((a) => `${aName(a.addonId)}${a.qty > 1 ? ` ×${a.qty}` : ''}`)
    .join(' · ');
  const prepay =
    booking.prepayment > 0 ? `${tc('prepay')}: ${booking.prepayment.toLocaleString(locale)} ₸` : '';

  const timeRange = `${fmtTime(booking.startAt, locale)}–${fmtTime(booking.endAt, locale)}`;
  // Полная информация в тултипе — маленькие блоки читаемы по наведению.
  const tooltip = [timeRange, client?.name, preorder, prepay, booking.comment]
    .filter(Boolean)
    .join('\n');

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={tooltip}
      style={{
        ...style,
        borderLeftColor: resource.color, // рамка — цвет объекта, фон — цвет статуса
      }}
      className={`absolute flex flex-col overflow-hidden rounded-md border border-border border-l-[3px] px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm transition-shadow hover:shadow ${
        STATUS_BG[booking.status]
      } ${cancelled ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-1 font-medium">
        <span
          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
          style={{backgroundColor: resource.color}}
        />
        <span className="truncate">{timeRange}</span>
      </div>
      {showResource && (
        <div className="truncate font-medium" style={{color: resource.color}}>
          {locale === 'kk' ? resource.nameKk : resource.nameRu}
        </div>
      )}
      <div className="truncate text-muted">{client?.name ?? '—'}</div>
      {preorder && <div className="truncate text-[10px]">{preorder}</div>}
      {prepay && <div className="truncate text-[10px] text-emerald-700 dark:text-emerald-400">{prepay}</div>}
      {booking.comment && (
        <div className="overflow-hidden text-[10px] italic text-muted [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
          {booking.comment}
        </div>
      )}
      {clipped && (
        <div
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-card/90 to-transparent px-1 text-center text-[9px] font-medium text-muted"
          title={timeRange}
        >
          {tc('continues')} ↓
        </div>
      )}
    </button>
  );
}
