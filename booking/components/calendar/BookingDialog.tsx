'use client';

import {useEffect, useMemo, useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import {computePrice} from '@/lib/pricing';
import {durationHours, intervalsOverlap} from '@/lib/time';
import {toLocalInput, fromLocalInput, fmtTime} from '@/lib/calendar';
import {saveBooking, cancelBookingAction, getBookingHistory} from '@/lib/actions';
import {dialogField, dialogLabel} from '@/lib/ui';
import {TARIFFS, DISCOUNT_TYPES, BOOKING_STATUSES, BOOKING_SOURCES, PAYMENT_METHODS} from '@/lib/enums';
import type {
  MockResource, MockAddon, MockClient, MockBooking, Tariff, BookingStatus, BookingSource, DiscountType,
  PaymentMethod,
} from '@/lib/types';
import ClientPicker from './ClientPicker';
import ResourceSummary from './ResourceSummary';

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
  const tb = useTranslations('booking');
  const tt = useTranslations('tariff');
  const ts = useTranslations('status');
  const tsrc = useTranslations('source');
  const tpm = useTranslations('payment');

  const init = booking;
  const defaultStart = init?.startAt ?? prefill?.startAt ?? new Date();
  const defaultEnd = init?.endAt ?? new Date(defaultStart.getTime() + 3 * 3600_000);

  const [resourceId, setResourceId] = useState(init?.resourceId ?? prefill?.resourceId ?? resources[0].id);
  const [clientId, setClientId] = useState(init?.clientId ?? clients[0]?.id ?? '');
  // Дата брони + время начала + длительность в часах; конец считается автоматически
  // (ночные и многодневные брони — просто большим числом часов).
  const [date, setDate] = useState(() => toLocalInput(defaultStart).slice(0, 10));
  const [startTime, setStartTime] = useState(() => toLocalInput(defaultStart).slice(11, 16));
  const [hours, setHours] = useState(() =>
    String(init ? durationHours(defaultStart, defaultEnd) : 3),
  );
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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>(init?.paymentMethod ?? '');
  const [comment, setComment] = useState(init?.comment ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Журнал изменений (edit-режим) — подгружаем при открытии брони.
  type AuditEntry = {
    id: string;
    action: 'CREATE' | 'UPDATE' | 'CANCEL';
    userName: string;
    at: string | Date;
    changes: {field: string; from: unknown; to: unknown}[];
  };
  const [history, setHistory] = useState<AuditEntry[]>([]);
  useEffect(() => {
    if (mode !== 'edit' || !booking?.id) return;
    let alive = true;
    getBookingHistory(booking.id).then((r) => {
      if (alive && r.ok) setHistory(r.entries as AuditEntry[]);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.id]);

  const resource = resources.find((r) => r.id === resourceId)!;
  // Тот же минимум, что применит сервер (lib/bookings.ts): max(объектный, глобальный).
  const effectiveMinHours = Math.max(resource.minHours, minBookingHours);
  const startAt = fromLocalInput(`${date}T${startTime}`);
  const endAt = new Date(startAt.getTime() + (Number(hours) || 0) * 3600_000);
  // Очищенные поля даты/времени дают Invalid Date — NaN проходит все сравнения молча.
  const timesValid = !Number.isNaN(startAt.getTime()) && Number(hours) > 0;
  // Подсказка «до …»: время конца; при переходе на другой день — с датой.
  const sameDay = timesValid && toLocalInput(startAt).slice(0, 10) === toLocalInput(endAt).slice(0, 10);
  const endHint = !timesValid
    ? ''
    : sameDay
      ? fmtTime(endAt, locale)
      : new Intl.DateTimeFormat(locale, {
          timeZone: 'Asia/Almaty', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
        }).format(endAt);

  const price = useMemo(() => {
    const lines = addons
      .filter((a) => (qty[a.id] ?? 0) > 0)
      .map((a) => ({price: a.price, qty: qty[a.id]}));
    return computePrice(resource, tariff, startAt, endAt, lines, guests, {
      type: discountType,
      value: Number(discountValue) || 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceId, tariff, date, startTime, hours, JSON.stringify(qty), guests, discountType, discountValue]);

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
        intervalsOverlap(b.startAt, b.endAt, startAt, endAt),
    );
    if (conflict) return setError(tb('occupied'));
    if (!clientId) return setError(tb('clientRequired'));

    setSaving(true);
    try {
      const res = await saveBooking({
        id: booking?.id,
        resourceId, clientId, startAt, endAt, status, source, tariff, guests,
        total: Number(total) || 0,
        deposit: Number(deposit) || 0,
        prepayment: Number(prepayment) || 0,
        paymentMethod: paymentMethod || null,
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

  // Форматирование строк журнала: даты/время Almaty, значения полей человекочитаемо.
  const fmtAt = (d: string | Date) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: 'Asia/Almaty', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    }).format(new Date(d));
  const FIELD_LABEL: Record<string, string> = {
    resourceId: 'resource', clientId: 'client', startAt: 'start', endAt: 'end',
    tariff: 'tariff', guests: 'guests', total: 'total', deposit: 'deposit',
    prepayment: 'prepayment', paymentMethod: 'paymentMethod', status: 'status', source: 'source',
    discountType: 'discount', discountValue: 'discount', comment: 'comment', addons: 'addons',
  };
  const fmtVal = (field: string, v: unknown): string => {
    if (v == null || v === '') return '—';
    if (field === 'status') return ts(String(v));
    if (field === 'source') return tsrc(String(v));
    if (field === 'paymentMethod') return tpm(String(v));
    if (field === 'tariff') return tt(String(v));
    if (field === 'discountType') return tb(`discountKind.${v}`);
    if (field === 'startAt' || field === 'endAt') return fmtAt(String(v));
    if (field === 'resourceId') return name(resources.find((r) => r.id === v) ?? resource);
    if (field === 'clientId') return clients.find((c) => c.id === v)?.name ?? String(v);
    if (typeof v === 'number') return v.toLocaleString();
    return String(v);
  };

  const fieldCls = dialogField;
  const labelCls = dialogLabel;

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
        <ResourceSummary resource={resource} effectiveMinHours={effectiveMinHours} locale={locale} />

        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls}>
            {tb('resource')}
            <select className={fieldCls} value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
              {resources.map((r) => <option key={r.id} value={r.id}>{name(r)}</option>)}
            </select>
          </label>
          <ClientPicker
            clients={clients}
            value={clientId}
            initialName={clients.find((c) => c.id === clientId)?.name}
            onChange={setClientId}
          />
          <label className={labelCls}>
            {tb('date')}
            <input type="date" className={fieldCls} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <div className={labelCls}>
            <span className="flex items-center justify-between">
              <span>{tb('start')} / {tb('hours')}</span>
              {timesValid && (
                <span className={`text-[10px] normal-case ${sameDay ? 'text-muted' : 'text-amber-600'}`}>
                  {tb('endHint', {t: endHint})}
                </span>
              )}
            </span>
            <div className="flex gap-1.5">
              <input type="time" className={`${fieldCls} flex-1`} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              <input type="number" min={1} step={1} className={`${fieldCls} flex-1`}
                value={hours} onChange={(e) => setHours(e.target.value)} />
            </div>
          </div>
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
              {BOOKING_STATUSES.map((x) => <option key={x} value={x}>{ts(x)}</option>)}
            </select>
          </label>
          <label className={labelCls}>
            {tb('source')}
            <select className={fieldCls} value={source} onChange={(e) => setSource(e.target.value as BookingSource)}>
              {BOOKING_SOURCES.map((x) => <option key={x} value={x}>{tsrc(x)}</option>)}
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
          <label className={labelCls}>
            {tb('paymentMethod')}
            <select className={fieldCls} value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod | '')}>
              <option value="">—</option>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{tpm(m)}</option>)}
            </select>
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
          <div role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40">{error}</div>
        )}

        {/* Журнал изменений (кто/когда/что менял) */}
        {mode === 'edit' && history.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <div className="mb-2 text-xs font-medium uppercase text-muted">{tb('history')}</div>
            <ul className="space-y-1.5 text-xs">
              {history.map((h) => (
                <li key={h.id} className="text-muted">
                  <span className="font-medium text-foreground">
                    {h.action === 'CREATE' ? tb('auditCreate') : h.action === 'CANCEL' ? tb('auditCancel') : tb('auditUpdate')}
                  </span>
                  {' · '}{h.userName}{' · '}{fmtAt(h.at)}
                  {h.changes.length > 0 && (
                    <ul className="ml-3 mt-0.5 list-disc space-y-0.5">
                      {h.changes.map((c, i) => (
                        <li key={i}>
                          {tb(FIELD_LABEL[c.field] ?? c.field)}: {fmtVal(c.field, c.from)} → {fmtVal(c.field, c.to)}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
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
