'use client';

import {useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {toAlmaty, fromAlmaty} from '@/lib/time';

/**
 * Полноценный всплывающий календарь-месяц в шапке (замена кнопки «Сегодня»):
 * сетка дней пн–вс, листание месяцев ‹ ›, подсветка «сегодня» и выбранного дня,
 * кнопка «Сегодня» — в подвале попапа. Все даты — «стеночные» Алматы.
 */
export default function DatePickerPopup({value, onPick}: {value: Date; onPick: (d: Date) => void}) {
  const locale = useLocale();
  const t = useTranslations('calendar');
  const [open, setOpen] = useState(false);
  // Показываемый месяц (стеночные год/месяц Алматы просматриваемого дня).
  const [ym, setYm] = useState(() => {
    const w = toAlmaty(value);
    return {y: w.getFullYear(), m: w.getMonth()};
  });

  const intl = locale === 'kk' ? 'kk-KZ' : 'ru-RU';
  const today = toAlmaty(new Date());
  const sel = toAlmaty(value);

  const openPopup = () => {
    const w = toAlmaty(value);
    setYm({y: w.getFullYear(), m: w.getMonth()});
    setOpen(true);
  };

  const first = new Date(ym.y, ym.m, 1);
  const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // пустых ячеек до 1-го числа (пн=0)
  const cells: Array<number | null> = [
    ...Array.from({length: lead}, () => null),
    ...Array.from({length: daysInMonth}, (_, i) => i + 1),
  ];

  const monthLabel = new Intl.DateTimeFormat(intl, {month: 'long', year: 'numeric'}).format(first);
  // Заголовки пн…вс (2026-07-20 — понедельник).
  const weekdays = Array.from({length: 7}, (_, i) =>
    new Intl.DateTimeFormat(intl, {weekday: 'short', timeZone: 'UTC'}).format(new Date(Date.UTC(2026, 6, 20 + i))),
  );

  const shiftMonth = (delta: number) => {
    const d = new Date(ym.y, ym.m + delta, 1);
    setYm({y: d.getFullYear(), m: d.getMonth()});
  };

  const pick = (d: Date) => {
    onPick(d);
    setOpen(false);
  };

  const isToday = (d: number) => ym.y === today.getFullYear() && ym.m === today.getMonth() && d === today.getDate();
  const isSel = (d: number) => ym.y === sel.getFullYear() && ym.m === sel.getMonth() && d === sel.getDate();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPopup())}
        title={t('pickDate')}
        aria-label={t('pickDate')}
        className={`rounded-md border border-border px-2.5 py-1.5 text-sm font-medium hover:bg-subtle ${open ? 'bg-subtle' : ''}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>

      {open && (
        <>
          {/* Клик мимо попапа — закрыть */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-border bg-card p-3 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <button onClick={() => shiftMonth(-1)} aria-label="prev month"
                className="rounded-md px-2 py-1 text-sm hover:bg-subtle">‹</button>
              <span className="text-sm font-medium capitalize">{monthLabel}</span>
              <button onClick={() => shiftMonth(1)} aria-label="next month"
                className="rounded-md px-2 py-1 text-sm hover:bg-subtle">›</button>
            </div>

            <div className="grid grid-cols-7 gap-0.5 text-center">
              {weekdays.map((w) => (
                <div key={w} className="py-1 text-[10px] font-medium uppercase text-muted">{w}</div>
              ))}
              {cells.map((d, i) =>
                d === null ? (
                  <div key={`e${i}`} />
                ) : (
                  <button
                    key={d}
                    onClick={() => pick(fromAlmaty(new Date(ym.y, ym.m, d, 12, 0, 0, 0)))}
                    className={`rounded-md py-1 text-sm tabular-nums hover:bg-subtle ${
                      isSel(d)
                        ? 'bg-primary font-semibold text-primary-foreground hover:bg-primary'
                        : isToday(d)
                          ? 'font-semibold text-primary ring-1 ring-primary'
                          : ''
                    }`}
                  >
                    {d}
                  </button>
                ),
              )}
            </div>

            <div className="mt-2 border-t border-border pt-2 text-center">
              <button onClick={() => pick(new Date())}
                className="rounded-md px-3 py-1 text-sm font-medium text-primary hover:bg-subtle">
                {t('today')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
