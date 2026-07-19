'use client';

import {useEffect, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {fromLocalInput, fmtTime} from '@/lib/calendar';
import {formatPhoneDraft} from '@/lib/phone';
import {submitBookingRequest, type PublicBookingError} from '@/lib/public-actions';

type ResourceOption = {
  id: string;
  nameRu: string;
  nameKk: string;
  capacity: number;
};

const FIELD =
  'rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40';

// Поля времени/даты: 16px шрифт (iOS не зумит при фокусе) + крупнее тап-зона.
const TOUCH_FIELD =
  'rounded-md border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-foreground/40';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Слоты времени по 30 минут: 00:00, 00:30 … 23:30 (сетка ТЗ §, удобно с телефона). */
const TIME_SLOTS: string[] = Array.from({length: 48}, (_, i) =>
  `${pad(Math.floor(i / 2))}:${i % 2 === 0 ? '00' : '30'}`,
);

/** Длительность: полные часы 1–12 (конец считается автоматически). */
const HOUR_OPTIONS: number[] = Array.from({length: 12}, (_, i) => i + 1);

/** Сегодняшняя дата в формате YYYY-MM-DD (по часам устройства). */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const ERROR_KEYS: Record<PublicBookingError, string> = {
  OVERLAP: 'errOccupied',
  MIN_DURATION: 'errMinDuration',
  INVALID_RANGE: 'errInvalidRange',
  RESOURCE_NOT_FOUND: 'errGeneric',
  INVALID_INPUT: 'errGeneric',
  RATE_LIMITED: 'errRateLimited',
};

export default function BookingRequestForm({resources}: {resources: ResourceOption[]}) {
  const t = useTranslations('publicBooking');
  const locale = useLocale();

  const [resourceId, setResourceId] = useState(resources[0]?.id ?? '');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+7'); // префикс подставляется и восстанавливается при вводе
  const [date, setDate] = useState('');
  const [start, setStart] = useState('20:00');
  const [hours, setHours] = useState('3');
  const [guests, setGuests] = useState('1');
  const [comment, setComment] = useState('');
  const [website, setWebsite] = useState(''); // honeypot: люди не видят, боты заполняют

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Дату ставим после монтирования — избегаем рассинхрона SSR/CSR.
  useEffect(() => {
    setDate(todayStr());
  }, []);

  function resourceName(r: ResourceOption): string {
    return locale === 'kk' ? r.nameKk : r.nameRu;
  }

  // Превью конца брони: на время суток дата не влияет — считаем от фиктивного дня.
  const endPreview = new Date(fromLocalInput(`2000-01-01T${start}`).getTime() + Number(hours) * 3600_000);
  const endsNextDay = endPreview >= fromLocalInput('2000-01-02T00:00');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!resourceId || !date) return;
    setSaving(true);

    const startAt = fromLocalInput(`${date}T${start}`);
    const endAt = new Date(startAt.getTime() + Number(hours) * 3600_000);

    try {
      const res = await submitBookingRequest({
        resourceId,
        name,
        phone,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        guests: Number(guests) || 1,
        comment: comment.trim() || undefined,
        website: website || undefined,
      });
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(t(ERROR_KEYS[res.error] ?? 'errGeneric'));
      }
    } catch {
      setError(t('errGeneric'));
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setName('');
    setPhone('+7');
    setComment('');
    setGuests('1');
    setError(null);
    setSuccess(false);
  }

  if (success) {
    return (
      <div className="mt-6 flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl text-green-600 dark:bg-green-950/40">
          ✓
        </div>
        <h2 className="text-lg font-semibold tracking-tight">{t('successTitle')}</h2>
        <p className="text-sm text-muted">{t('successText')}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-2 text-sm font-medium text-muted hover:text-foreground"
        >
          {t('again')}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
      {/* Honeypot: скрыто от людей (и от скринридеров), боты-автозаполнялки попадаются */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">{t('resource')}</span>
        <select
          value={resourceId}
          onChange={(e) => setResourceId(e.target.value)}
          required
          className={FIELD}
        >
          {resources.map((r) => (
            <option key={r.id} value={r.id}>
              {resourceName(r)} · {t('capacity', {n: r.capacity})}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">{t('name')}</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={120}
          className={FIELD}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">{t('phone')}</span>
        <input
          value={phone}
          onChange={(e) => setPhone(formatPhoneDraft(e.target.value, phone))}
          type="tel"
          required
          placeholder="+7 700 000 00 00"
          className={FIELD}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">{t('date')}</span>
        <input
          value={date}
          onChange={(e) => setDate(e.target.value)}
          type="date"
          required
          className={TOUCH_FIELD}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">{t('start')}</span>
          <select
            value={start}
            onChange={(e) => setStart(e.target.value)}
            required
            className={TOUCH_FIELD}
          >
            {TIME_SLOTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">{t('hours')}</span>
          <select
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            required
            className={TOUCH_FIELD}
          >
            {HOUR_OPTIONS.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Вычисленный конец брони; переход через полночь подсвечиваем */}
      <p className={`-mt-1 text-xs ${endsNextDay ? 'text-amber-600' : 'text-muted'}`}>
        {t('endHint', {t: fmtTime(endPreview, locale)})}
        {endsNextDay ? ` · ${t('nextDayHint')}` : ''}
      </p>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">{t('guests')}</span>
        <input
          value={guests}
          onChange={(e) => setGuests(e.target.value)}
          type="number"
          inputMode="numeric"
          min={1}
          required
          className={TOUCH_FIELD}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">{t('comment')}</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder={t('commentPlaceholder')}
          className={FIELD}
        />
      </label>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="mt-2 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {saving ? t('sending') : t('submit')}
      </button>
    </form>
  );
}
