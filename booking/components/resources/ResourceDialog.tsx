'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {saveResource} from '@/lib/actions';
import type {MockResource} from '@/lib/mock-data';
import {dialogField, dialogLabel} from '@/lib/ui';

const numOrNull = (s: string) => (s.trim() === '' ? null : Number(s));

export default function ResourceDialog({
  resource, onClose, onSaved,
}: {
  resource?: MockResource;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const t = useTranslations('resources');
  const ta = useTranslations('amenity');
  const r = resource;
  const mode = r ? 'edit' : 'create';

  const [kind, setKind] = useState<'COMPLEX' | 'KARAOKE'>(r?.kind ?? 'COMPLEX');
  const [nameRu, setNameRu] = useState(r?.nameRu ?? '');
  const [nameKk, setNameKk] = useState(r?.nameKk ?? '');
  const [capacity, setCapacity] = useState(String(r?.capacity ?? 10));
  const [color, setColor] = useState(r?.color ?? '#6366f1');
  const [sortOrder, setSortOrder] = useState(String(r?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(r?.isActive ?? true);
  const [floors, setFloors] = useState((r?.floors ?? []).join('\n'));
  const [am, setAm] = useState({
    hasKaraoke: r?.hasKaraoke ?? false,
    hasFinnishSauna: r?.hasFinnishSauna ?? false,
    hasHammam: r?.hasHammam ?? false,
    hasPool: r?.hasPool ?? false,
    hasBanquet: r?.hasBanquet ?? false,
    hasKitchen: r?.hasKitchen ?? false,
  });
  const [restRooms, setRestRooms] = useState(String(r?.restRooms ?? 0));
  const [hourlyPrice, setHourlyPrice] = useState(String(r?.hourlyPrice ?? 10000));
  const [minHours, setMinHours] = useState(String(r?.minHours ?? 3));
  const [halfDayPrice, setHalfDayPrice] = useState(r?.halfDayPrice != null ? String(r.halfDayPrice) : '');
  const [fullDayPrice, setFullDayPrice] = useState(r?.fullDayPrice != null ? String(r.fullDayPrice) : '');
  const [weekendPrice, setWeekendPrice] = useState(r?.weekendPrice != null ? String(r.weekendPrice) : '');
  const [weekdayMinDeposit, setWeekdayMinDeposit] = useState(r?.weekdayMinDeposit != null ? String(r.weekdayMinDeposit) : '');
  const [priceNote, setPriceNote] = useState(r?.priceNote ?? '');
  const [photos, setPhotos] = useState((r?.photos ?? []).join(', '));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await saveResource({
      id: r?.id,
      kind, nameRu, nameKk,
      capacity: Number(capacity),
      color, sortOrder: Number(sortOrder), isActive,
      floors: floors.split('\n').map((s) => s.trim()).filter(Boolean),
      ...am,
      restRooms: Number(restRooms),
      hourlyPrice: Number(hourlyPrice),
      minHours: Number(minHours),
      halfDayPrice: numOrNull(halfDayPrice),
      fullDayPrice: numOrNull(fullDayPrice),
      weekendPrice: numOrNull(weekendPrice),
      weekdayMinDeposit: numOrNull(weekdayMinDeposit),
      priceNote: priceNote.trim() || undefined,
      photos: photos.split(',').map((s) => s.trim()).filter(Boolean),
    });
    setSaving(false);
    onSaved?.();
    onClose();
  }

  const field = dialogField;
  const label = dialogLabel;
  const section = 'mt-3 mb-1 text-xs font-medium uppercase tracking-wide text-muted';

  const amItems: [keyof typeof am, string][] = [
    ['hasKaraoke', ta('karaoke')], ['hasFinnishSauna', ta('sauna')], ['hasHammam', ta('hammam')],
    ['hasPool', ta('pool')], ['hasBanquet', ta('banquet')], ['hasKitchen', ta('kitchen')],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">{mode === 'create' ? t('add') : t('edit')}</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <label className={label}>{t('kind')}
            <select className={field} value={kind} onChange={(e) => setKind(e.target.value as 'COMPLEX' | 'KARAOKE')}>
              <option value="COMPLEX">{t('COMPLEX')}</option>
              <option value="KARAOKE">{t('KARAOKE')}</option>
            </select>
          </label>
          <label className={label}>{t('nameRu')}<input className={field} value={nameRu} onChange={(e) => setNameRu(e.target.value)} /></label>
          <label className={label}>{t('nameKk')}<input className={field} value={nameKk} onChange={(e) => setNameKk(e.target.value)} /></label>
          <label className={label}>{t('capacity')}<input type="number" className={field} value={capacity} onChange={(e) => setCapacity(e.target.value)} /></label>
          <label className={label}>{t('color')}<input type="color" className="h-9 rounded-md border border-border" value={color} onChange={(e) => setColor(e.target.value)} /></label>
          <label className={label}>{t('sortOrder')}<input type="number" className={field} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} /></label>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          {t('active')}
        </label>

        <div className={section}>{t('composition')}</div>
        <label className={label}>{t('floors')}
          <textarea className={field} rows={3} value={floors} onChange={(e) => setFloors(e.target.value)} />
        </label>
        <div className="mt-2 grid grid-cols-2 gap-1.5 md:grid-cols-3">
          {amItems.map(([k, lbl]) => (
            <label key={k} className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs">
              <input type="checkbox" checked={am[k]} onChange={(e) => setAm((m) => ({...m, [k]: e.target.checked}))} />
              {lbl}
            </label>
          ))}
          <label className={`${label} col-span-2 md:col-span-1`}>{t('restRooms')}
            <input type="number" className={field} value={restRooms} onChange={(e) => setRestRooms(e.target.value)} />
          </label>
        </div>

        <div className={section}>{t('tariffsTitle')}</div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <label className={label}>{t('hourly')}<input type="number" className={field} value={hourlyPrice} onChange={(e) => setHourlyPrice(e.target.value)} /></label>
          <label className={label}>{t('minHours')}<input type="number" className={field} value={minHours} onChange={(e) => setMinHours(e.target.value)} /></label>
          <label className={label}>{t('halfDay')}<input type="number" className={field} value={halfDayPrice} onChange={(e) => setHalfDayPrice(e.target.value)} /></label>
          <label className={label}>{t('fullDay')}<input type="number" className={field} value={fullDayPrice} onChange={(e) => setFullDayPrice(e.target.value)} /></label>
          <label className={label}>{t('weekend')}<input type="number" className={field} value={weekendPrice} onChange={(e) => setWeekendPrice(e.target.value)} /></label>
          <label className={label}>{t('weekdayMinDeposit')}<input type="number" className={field} value={weekdayMinDeposit} onChange={(e) => setWeekdayMinDeposit(e.target.value)} /></label>
        </div>
        <label className={`${label} mt-3`}>{t('priceNote')}<input className={field} value={priceNote} onChange={(e) => setPriceNote(e.target.value)} /></label>
        <label className={`${label} mt-3`}>{t('photos')}<input className={field} value={photos} onChange={(e) => setPhotos(e.target.value)} /></label>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-subtle">{t('back')}</button>
          <button onClick={save} disabled={saving || !nameRu.trim() || !nameKk.trim()} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {mode === 'create' ? t('create') : t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
