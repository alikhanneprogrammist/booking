'use client';

import {useTranslations} from 'next-intl';
import type {MockResource} from '@/lib/types';

/** Состав объекта в диалоге брони (ТЗ §4.5 FR-BOOK-2): этажи, удобства, тарифы. */
export default function ResourceSummary({
  resource, effectiveMinHours, locale,
}: {
  resource: MockResource;
  effectiveMinHours: number; // max(объектный, глобальный) — как применяет сервер
  locale: string;
}) {
  const tb = useTranslations('booking');
  const ta = useTranslations('amenity');

  const name = locale === 'kk' ? resource.nameKk : resource.nameRu;
  const amenities: string[] = [];
  if (resource.hasKaraoke) amenities.push(ta('karaoke'));
  if (resource.hasFinnishSauna) amenities.push(ta('sauna'));
  if (resource.hasHammam) amenities.push(ta('hammam'));
  if (resource.hasPool) amenities.push(ta('pool'));
  if (resource.hasBanquet) amenities.push(ta('banquet'));
  if (resource.restRooms > 0) amenities.push(ta('rooms', {n: resource.restRooms}));
  if (resource.hasKitchen) amenities.push(ta('kitchen'));

  return (
    <div className="mb-3 rounded-lg border border-border bg-subtle p-3">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{backgroundColor: resource.color}} />
        <span className="text-sm font-medium">{name}</span>
        <span className="text-xs text-muted">· {resource.capacity}</span>
      </div>
      <div className="mb-2 text-xs font-medium uppercase text-muted">{tb('composition')}</div>
      <ul className="mb-2 space-y-0.5 text-xs">
        {resource.floors.map((f, i) => <li key={i}>· {f}</li>)}
      </ul>
      <div className="flex flex-wrap gap-1">
        {amenities.map((a) => (
          <span key={a} className="rounded bg-card px-1.5 py-0.5 text-[10px] text-muted ring-1 ring-border">{a}</span>
        ))}
      </div>
      {/* Тарифы (ТЗ §4.9) */}
      <div className="mt-2 text-[11px] text-muted">
        {tb('tariffs')}: {resource.hourlyPrice.toLocaleString(locale)}/ч (мин {effectiveMinHours}ч)
        {resource.halfDayPrice ? ` · 12ч ${resource.halfDayPrice.toLocaleString(locale)}` : ''}
        {resource.fullDayPrice ? ` · 24ч ${resource.fullDayPrice.toLocaleString(locale)}` : ''}
        {resource.weekendPrice ? ` · вых ${resource.weekendPrice.toLocaleString(locale)}` : ''}
      </div>
    </div>
  );
}
