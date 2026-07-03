'use client';

import {useMemo, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import type {MockClient} from '@/lib/types';
import {
  upcomingBirthdays, birthdaysInMonth, formatBirthday, ageTurning, type Today,
} from '@/lib/birthdays';
import {sectionHead} from '@/lib/ui';

export default function BirthdaysView({
  clients, today,
}: {
  clients: MockClient[];
  today: Today;
}) {
  const t = useTranslations('birthdays');
  const locale = useLocale();
  const [month, setMonth] = useState(today.month);

  const upcoming = useMemo(() => upcomingBirthdays(clients, today, 7), [clients, today]);
  const inMonth = useMemo(() => birthdaysInMonth(clients, month), [clients, month]);

  const monthName = (m: number) =>
    new Intl.DateTimeFormat(locale, {month: 'long', timeZone: 'UTC'}).format(new Date(Date.UTC(2020, m, 1)));
  const dayLabel = (d: number) => (d === 0 ? t('today') : t('inDays', {n: d}));

  const rowCls = 'flex items-center gap-3 px-4 py-3 text-sm hover:bg-subtle';
  const emptyCls = 'rounded-lg border border-border py-6 text-center text-sm text-muted';
  const listCls = 'divide-y divide-border overflow-hidden rounded-lg border border-border';
  const headCls = sectionHead;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>

      {/* Ближайшие (7 дней) — напоминание */}
      <section className="mt-5">
        <h2 className={headCls}>{t('upcoming')}</h2>
        {upcoming.length === 0 ? (
          <div className={emptyCls}>{t('noUpcoming')}</div>
        ) : (
          <div className={listCls}>
            {upcoming.map((c) => (
              <Link key={c.id} href={`/clients/${c.id}`} className={rowCls}>
                <span className="text-base leading-none">🎂</span>
                <span className="flex-1 truncate font-medium">{c.name}</span>
                <span className="hidden shrink-0 text-muted sm:block">
                  {formatBirthday(c.dateOfBirth as Date, locale)} · {t('turns', {n: ageTurning(c.dateOfBirth as Date, today)})}
                </span>
                <span className={`w-24 shrink-0 text-right ${c.daysUntil === 0 ? 'font-medium text-primary' : 'text-muted'}`}>
                  {dayLabel(c.daysUntil)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Помесячная аналитика */}
      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className={headCls + ' mb-0'}>{t('byMonth')}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMonth((m) => (m + 11) % 12)}
              className="rounded-md border border-border px-2 py-1 text-sm font-medium hover:bg-subtle"
              aria-label="prev month"
            >
              ‹
            </button>
            <span className="min-w-28 text-center text-sm font-medium capitalize">{monthName(month)}</span>
            <button
              onClick={() => setMonth((m) => (m + 1) % 12)}
              className="rounded-md border border-border px-2 py-1 text-sm font-medium hover:bg-subtle"
              aria-label="next month"
            >
              ›
            </button>
          </div>
        </div>
        <div className="mb-2 text-xs text-muted">{t('count', {n: inMonth.length})}</div>
        {inMonth.length === 0 ? (
          <div className={emptyCls}>{t('noneInMonth')}</div>
        ) : (
          <div className={listCls}>
            {inMonth.map((c) => (
              <Link key={c.id} href={`/clients/${c.id}`} className={rowCls}>
                <span className="w-8 shrink-0 tabular-nums text-muted">{(c.dateOfBirth as Date).getUTCDate()}</span>
                <span className="flex-1 truncate font-medium">{c.name}</span>
                <span className="shrink-0 text-muted">{c.phone}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
