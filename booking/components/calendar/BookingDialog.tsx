'use client';

import {useEffect, useMemo, useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {computePrice} from '@/lib/pricing';
import {durationHours} from '@/lib/time';
import {toLocalInput, fromLocalInput, rangesOverlap, nextDayStr, dayDiffStr} from '@/lib/calendar';
import {saveBooking, cancelBookingAction, saveClient} from '@/lib/actions';
import type {
  MockResource, MockAddon, MockClient, MockBooking, Tariff, BookingStatus, BookingSource, DiscountType,
} from '@/lib/mock-data';

const TARIFFS: Tariff[] = ['HOURLY', 'HALF_DAY', 'FULL_DAY', 'WEEKEND', 'CUSTOM'];
const DISCOUNT_TYPES: DiscountType[] = ['NONE', 'PERCENT', 'AMOUNT'];
const STATUSES: BookingStatus[] = ['NEW', 'CONFIRMED', 'PREPAID', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
const SOURCES: BookingSource[] = ['ADMIN', 'PHONE', 'WHATSAPP', 'INSTAGRAM', 'WIDGET'];

export default function BookingDialog({
  mode, booking, prefill, resources, addons, clients, bookings, locale,
  minBookingHours, onSaved, onClose,
}: {
  mode: 'create' | 'edit';
  booking?: MockBooking;
  prefill?: {resourceId: string; startAt: Date};
  resources: MockResource[];
  addons: MockAddon[];
  clients: MockClient[];
  bookings: MockBooking[];
  locale: string;
  minBookingHours: number; // глобальный минимум заведения (сервер применяет max с объектным)
  onSaved: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const tb = useTranslations('booking');
  const tt = useTranslations('tariff');
  const ts = useTranslations('status');
  const tsrc = useTranslations('source');
  const ta = useTranslations('amenity');
  const tc = useTranslations('clients');

  const init = booking;
  const defaultStart = init?.startAt ?? prefill?.startAt ?? new Date();
  const defaultEnd = init?.endAt ?? new Date(defaultStart.getTime() + 3 * 3600_000);

  const [resourceId, setResourceId] = useState(init?.resourceId ?? prefill?.resourceId ?? resources[0].id);
  const [clientId, setClientId] = useState(init?.clientId ?? clients[0]?.id ?? '');
  // Дата брони + время начала/конца (набор с клавиатуры). Конец ≤ начала → следующий день.
  const [date, setDate] = useState(() => toLocalInput(defaultStart).slice(0, 10));
  const [startTime, setStartTime] = useState(() => toLocalInput(defaultStart).slice(11, 16));
  const [endTime, setEndTime] = useState(() => toLocalInput(defaultEnd).slice(11, 16));
  // Бронь длиннее суток невыразима правилом «конец ≤ начала → +1 день»:
  // дата конца редактируется явно, иначе сохранение молча укоротит бронь.
  const [multiDay] = useState(
    () => dayDiffStr(toLocalInput(defaultStart).slice(0, 10), toLocalInput(defaultEnd).slice(0, 10)) >= 2,
  );
  const [endDate, setEndDate] = useState(() => toLocalInput(defaultEnd).slice(0, 10));
  const [guests, setGuests] = useState(init?.guests ?? 2);
  const [tariff, setTariff] = useState<Tariff>(init?.tariff ?? 'HOURLY');
  const [status, setStatus] = useState<BookingStatus>(init?.status ?? 'NEW');
  const [source, setSource] = useState<BookingSource>(init?.source ?? 'ADMIN');
  const [qty, setQty] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    init?.addons.forEach((a) => (m[a.addonId] = a.qty));
    return m;
  });
  const [discountType, setDiscountType] = useState<DiscountType>(init?.discountType ?? 'NONE');
  const [discountValue, setDiscountValue] = useState(String(init?.discountValue ?? 0));
  const [total, setTotal] = useState(String(init?.total ?? 0));
  // «Итого» правлено руками В ЭТОМ диалоге → авторасчёт выключен до кнопки «Авторасчёт».
  const [totalTouched, setTotalTouched] = useState(false);
  const [deposit, setDeposit] = useState(String(init?.deposit ?? 0));
  const [prepayment, setPrepayment] = useState(String(init?.prepayment ?? 0));
  const [comment, setComment] = useState(init?.comment ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Инлайн-создание клиента (FR-CLI-4)
  const [newOpen, setNewOpen] = useState(false);
  const [nName, setNName] = useState('');
  const [nPhone, setNPhone] = useState('');
  const [nErr, setNErr] = useState<string | null>(null);

  async function createClient() {
    setNErr(null);
    const res = await saveClient({name: nName.trim(), phone: nPhone.trim()});
    if (!res.ok) {
      setNErr(tc('duplicatePhone')); // единственная ожидаемая ошибка — занятый телефон
      return;
    }
    setClientId(res.client.id);
    setNewOpen(false);
    setNName('');
    setNPhone('');
    // Подтягиваем нового клиента в список (перечитываем серверные данные).
    router.refresh();
  }

  const resource = resources.find((r) => r.id === resourceId)!;
  // Тот же минимум, что применит сервер (lib/bookings.ts): max(объектный, глобальный).
  const effectiveMinHours = Math.max(resource.minHours, minBookingHours);
  const overnight = !multiDay && endTime <= startTime; // конец не позже начала → бронь через полночь
  const startAt = fromLocalInput(`${date}T${startTime}`);
  const endAt = fromLocalInput(`${multiDay ? endDate : overnight ? nextDayStr(date) : date}T${endTime}`);
  // Очищенные поля даты/времени дают Invalid Date — NaN проходит все сравнения молча.
  const timesValid = !Number.isNaN(startAt.getTime()) && !Number.isNaN(endAt.getTime());

  const price = useMemo(() => {
    const lines = addons
      .filter((a) => (qty[a.id] ?? 0) > 0)
      .map((a) => ({price: a.price, qty: qty[a.id]}));
    return computePrice(resource, tariff, startAt, endAt, lines, guests, {
      type: discountType,
      value: Number(discountValue) || 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceId, tariff, date, endDate, startTime, endTime, JSON.stringify(qty), guests, discountType, discountValue]);

  // В edit-режиме первый прогон пропускаем: показываем сохранённый итог (мог быть договорным).
  // Но любое изменение цено-влияющих полей пересчитывает итог, пока его не правили руками, —
  // иначе смена времени/скидки молча сохраняла бы устаревшую сумму.
  const skipFirstPrice = useRef(mode === 'edit');
  useEffect(() => {
    if (skipFirstPrice.current) {
      skipFirstPrice.current = false;
      return;
    }
    if (!totalTouched && Number.isFinite(price.total)) setTotal(String(price.total));
  }, [price.total, totalTouched]);

  const name = (r: MockResource) => (locale === 'kk' ? r.nameKk : r.nameRu);
  const aName = (a: MockAddon) => (locale === 'kk' ? a.nameKk : a.nameRu);

  const amenities: string[] = [];
  if (resource.hasKaraoke) amenities.push(ta('karaoke'));
  if (resource.hasFinnishSauna) amenities.push(ta('sauna'));
  if (resource.hasHammam) amenities.push(ta('hammam'));
  if (resource.hasPool) amenities.push(ta('pool'));
  if (resource.hasBanquet) amenities.push(ta('banquet'));
  if (resource.restRooms > 0) amenities.push(ta('rooms', {n: resource.restRooms}));
  if (resource.hasKitchen) amenities.push(ta('kitchen'));

  async function handleSave() {
    setError(null);
    // Клиентские пред-проверки для мгновенной реакции; БД — финальный арбитр.
    // Invalid Date проверяем первым: сравнения с NaN всегда false и пропустили бы всё ниже.
    if (!timesValid) return setError(tb('invalidRange'));
    if (endAt <= startAt) return setError(tb('invalidRange'));
    if (tariff === 'HOURLY' && durationHours(startAt, endAt) < effectiveMinHours) {
      return setError(tb('minDuration', {h: effectiveMinHours}));
    }
    const conflict = bookings.find(
      (b) =>
        b.resourceId === resourceId &&
        b.status !== 'CANCELLED' &&
        b.id !== booking?.id &&
        rangesOverlap(b.startAt, b.endAt, startAt, endAt),
    );
    if (conflict) return setError(tb('occupied'));
    if (!clientId) return setError(tb('client'));

    setSaving(true);
    try {
      const res = await saveBooking({
        id: booking?.id,
        resourceId, clientId, startAt, endAt, status, source, tariff, guests,
        total: Number(total) || 0,
        deposit: Number(deposit) || 0,
        prepayment: Number(prepayment) || 0,
        discountType,
        discountValue: discountType === 'NONE' ? 0 : Number(discountValue) || 0,
        comment: comment || undefined,
        addons: addons
          .filter((a) => (qty[a.id] ?? 0) > 0)
          .map((a) => ({addonId: a.id, qty: qty[a.id], priceAtBooking: a.price})),
      });
      if (!res.ok) {
        if (res.error === 'OVERLAP') return setError(tb('occupied'));
        if (res.error === 'INVALID_RANGE') return setError(tb('invalidRange'));
        if (res.error === 'MIN_DURATION') return setError(tb('minDuration', {h: effectiveMinHours}));
        return setError(('message' in res && res.message) ? res.message : String(res.error));
      }
      onSaved();
    } catch {
      setError(tb('errGeneric'));
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    if (!booking) return;
    setSaving(true);
    await cancelBookingAction(booking.id);
    setSaving(false);
    onSaved();
  }

  const fieldCls =
    'rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-foreground/40';
  const labelCls = 'flex flex-col gap-1 text-xs font-medium text-muted';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">
            {mode === 'create' ? tb('createTitle') : tb('editTitle')}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">✕</button>
        </div>

        {/* Состав объекта (ТЗ §4.5 FR-BOOK-2) */}
        <div className="mb-3 rounded-lg border border-border bg-subtle p-3">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{backgroundColor: resource.color}} />
            <span className="text-sm font-medium">{name(resource)}</span>
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
            {tb('tariffs')}: {resource.hourlyPrice.toLocaleString()}/ч (мин {effectiveMinHours}ч)
            {resource.halfDayPrice ? ` · 12ч ${resource.halfDayPrice.toLocaleString()}` : ''}
            {resource.fullDayPrice ? ` · 24ч ${resource.fullDayPrice.toLocaleString()}` : ''}
            {resource.weekendPrice ? ` · вых ${resource.weekendPrice.toLocaleString()}` : ''}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls}>
            {tb('resource')}
            <select className={fieldCls} value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
              {resources.map((r) => <option key={r.id} value={r.id}>{name(r)}</option>)}
            </select>
          </label>
          <div className={labelCls}>
            <span className="flex items-center justify-between">
              {tb('client')}
              <button type="button" className="text-[10px] text-blue-600 hover:underline" onClick={() => setNewOpen((v) => !v)}>
                {tb('newClient')}
              </button>
            </span>
            {newOpen ? (
              <div className="flex flex-col gap-1.5 rounded-md border border-border bg-subtle p-2">
                <input className={fieldCls} placeholder={tb('newClientName')} value={nName} onChange={(e) => setNName(e.target.value)} />
                <input className={fieldCls} placeholder={tb('newClientPhone')} value={nPhone} onChange={(e) => setNPhone(e.target.value)} />
                {nErr && <span className="text-[11px] text-red-600">{nErr}</span>}
                <button
                  type="button"
                  disabled={!nName.trim() || !nPhone.trim()}
                  onClick={createClient}
                  className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {tb('addClient')}
                </button>
              </div>
            ) : (
              <select className={fieldCls} value={clientId} onChange={(e) => setClientId(e.target.value)}>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
          <label className={labelCls}>
            {tb('date')}
            <input type="date" className={fieldCls} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <div className={labelCls}>
            <span className="flex items-center justify-between">
              <span>{tb('start')} / {tb('end')}</span>
              {overnight && (
                <span className="text-[10px] normal-case text-amber-600">
                  {endTime === startTime ? tb('fullDayHint') : tb('nextDayHint')}
                </span>
              )}
            </span>
            <div className="flex gap-1.5">
              <input type="time" className={`${fieldCls} flex-1`} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              <input type="time" className={`${fieldCls} flex-1`} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          {multiDay && (
            <label className={labelCls}>
              {tb('endDate')}
              <input type="date" className={fieldCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
          )}
          <label className={labelCls}>
            {tb('tariff')}
            <select className={fieldCls} value={tariff} onChange={(e) => setTariff(e.target.value as Tariff)}>
              {TARIFFS.map((x) => <option key={x} value={x}>{tt(x)}</option>)}
            </select>
          </label>
          <label className={labelCls}>
            {tb('guests')}
            <input type="number" min={1} className={fieldCls} value={guests} onChange={(e) => setGuests(Number(e.target.value))} />
          </label>
          <label className={labelCls}>
            {tb('status')}
            <select className={fieldCls} value={status} onChange={(e) => setStatus(e.target.value as BookingStatus)}>
              {STATUSES.map((x) => <option key={x} value={x}>{ts(x)}</option>)}
            </select>
          </label>
          <label className={labelCls}>
            {tb('source')}
            <select className={fieldCls} value={source} onChange={(e) => setSource(e.target.value as BookingSource)}>
              {SOURCES.map((x) => <option key={x} value={x}>{tsrc(x)}</option>)}
            </select>
          </label>
        </div>

        {/* Доп.услуги (ТЗ §4.5 FR-BOOK-4) */}
        <div className="mt-3">
          <div className="mb-1 text-xs font-medium text-muted">{tb('addons')}</div>
          <div className="grid grid-cols-2 gap-1.5">
            {addons.map((a) => {
              const on = (qty[a.id] ?? 0) > 0;
              return (
                <div key={a.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs">
                  <input
                    type="checkbox" checked={on}
                    onChange={(e) => setQty((m) => ({...m, [a.id]: e.target.checked ? 1 : 0}))}
                  />
                  <span className="flex-1 truncate">{aName(a)}</span>
                  <span className="text-muted">{a.price.toLocaleString()}</span>
                  {on && (
                    <input
                      type="number" min={1} value={qty[a.id]}
                      onChange={(e) => setQty((m) => ({...m, [a.id]: Math.max(1, Number(e.target.value))}))}
                      className="w-12 rounded border border-border bg-background px-1 py-0.5"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Скидка (ТЗ §4.9): % или фикс. сумма — пишется в историю клиента */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className={labelCls}>
            {tb('discount')}
            <select className={fieldCls} value={discountType}
              onChange={(e) => setDiscountType(e.target.value as DiscountType)}>
              {DISCOUNT_TYPES.map((x) => <option key={x} value={x}>{tb(`discountKind.${x}`)}</option>)}
            </select>
          </label>
          {discountType !== 'NONE' && (
            <label className={labelCls}>
              {discountType === 'PERCENT' ? tb('discountPercentValue') : tb('discountAmountValue')}
              <input type="number" min={0} className={fieldCls} value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)} />
            </label>
          )}
        </div>
        {price.discountAmount > 0 && (
          <div className="mt-1 text-[11px] text-muted">
            {tb('subtotal')}: {price.subtotal.toLocaleString()} ₸ · {tb('discount')}: −{price.discountAmount.toLocaleString()} ₸
          </div>
        )}

        {/* Суммы + авторасчёт (ТЗ §4.9 FR-PRICE-3) */}
        <div className="mt-3 grid grid-cols-3 gap-3">
          <label className={labelCls}>
            <span className="flex items-center justify-between">
              {tb('total')}
              <button type="button" className="text-[10px] text-blue-600 hover:underline"
                onClick={() => {setTotalTouched(false); setTotal(String(price.total));}}>
                {tb('autocalc')}
              </button>
            </span>
            <input className={fieldCls} value={total}
              onChange={(e) => {setTotalTouched(true); setTotal(e.target.value);}} />
          </label>
          <label className={labelCls}>
            {tb('deposit')}
            <input className={fieldCls} value={deposit} onChange={(e) => setDeposit(e.target.value)} />
          </label>
          <label className={labelCls}>
            {tb('prepayment')}
            <input className={fieldCls} value={prepayment} onChange={(e) => setPrepayment(e.target.value)} />
          </label>
        </div>

        <label className={`${labelCls} mt-3`}>
          {tb('comment')}
          <textarea className={fieldCls} rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
        </label>

        {price.warnings.length > 0 && (
          <div className="mt-2 text-xs text-amber-600">{price.warnings.join('; ')}</div>
        )}
        {error && (
          <div className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40">{error}</div>
        )}

        <div className="mt-4 flex items-center justify-between">
          {mode === 'edit' ? (
            <button
              onClick={handleCancel}
              disabled={saving}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/40"
            >
              {tb('cancelBooking')}
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-subtle">
              {tb('close')}
            </button>
            <button onClick={handleSave} disabled={saving} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {mode === 'create' ? tb('create') : tb('save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
