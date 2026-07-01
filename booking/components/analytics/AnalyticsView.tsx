'use client';

import {useMemo, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import type {MockBooking, MockResource, MockClient, MockAddon} from '@/lib/mock-data';
import {kpis, byResource, byEnum, topClients, addonStats, type CountRevenue} from '@/lib/analytics';
import {almatyDayStart, addDays} from '@/lib/calendar';
import {toAlmaty} from '@/lib/time';

type Preset = 'today' | 'week' | 'month' | '30d' | 'all';

// Скользящие окна «последние N дней» (вкл. сегодня).
const ROLLING: Record<string, number> = {today: 1, week: 7, '30d': 30};

export default function AnalyticsView({
  bookings, resources, clients, addons, today, nowMs,
}: {
  bookings: MockBooking[];
  resources: MockResource[];
  clients: MockClient[];
  addons: MockAddon[];
  today: {year: number; month: number; day: number};
  nowMs: number;
}) {
  const t = useTranslations('analytics');
  const ts = useTranslations('status');
  const tsrc = useTranslations('source');
  const tt = useTranslations('tariff');
  const locale = useLocale();
  const [preset, setPreset] = useState<Preset>('month');

  const rMap = useMemo(() => new Map(resources.map((r) => [r.id, r])), [resources]);
  const cMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const aMap = useMemo(() => new Map(addons.map((a) => [a.id, a])), [addons]);
  const rName = (id: string) => {
    const r = rMap.get(id);
    return r ? (locale === 'kk' ? r.nameKk : r.nameRu) : id;
  };
  const aName = (id: string) => {
    const a = aMap.get(id);
    return a ? (locale === 'kk' ? a.nameKk : a.nameRu) : id;
  };
  const money = (n: number) => `${n.toLocaleString()} ₸`;

  // Фильтр по периоду (время начала брони в Алматы).
  const filtered = useMemo(() => {
    if (preset === 'all') return bookings;
    if (preset === 'month') {
      return bookings.filter((b) => {
        const w = toAlmaty(b.startAt);
        return w.getFullYear() === today.year && w.getMonth() === today.month;
      });
    }
    const days = ROLLING[preset] ?? 30;
    const now = new Date(nowMs);
    const to = addDays(almatyDayStart(now), 1);
    const from = almatyDayStart(addDays(now, -(days - 1)));
    return bookings.filter((b) => b.startAt >= from && b.startAt < to);
  }, [bookings, preset, today, nowMs]);

  // Отменённые исключаем везде, кроме разбивки по статусам.
  const active = useMemo(() => filtered.filter((b) => b.status !== 'CANCELLED'), [filtered]);

  const k = useMemo(() => kpis(active), [active]);
  const resRows = useMemo(() => byResource(active), [active]);
  const statusRows = useMemo(() => byEnum(filtered, 'status'), [filtered]);
  const sourceRows = useMemo(() => byEnum(active, 'source'), [active]);
  const tariffRows = useMemo(() => byEnum(active, 'tariff'), [active]);
  const top = useMemo(() => topClients(active, 5), [active]);
  const addonRows = useMemo(() => addonStats(active), [active]);

  const presetBtn = (p: Preset, label: string) => (
    <button
      onClick={() => setPreset(p)}
      className={`rounded-md px-3 py-1 text-sm font-medium ${
        preset === p ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );

  const bar = (frac: number, color?: string) => (
    <div className="mt-1 h-1.5 overflow-hidden rounded bg-subtle">
      <div
        className={`h-full rounded ${color ? '' : 'bg-primary'}`}
        style={{width: `${Math.round(frac * 100)}%`, backgroundColor: color}}
      />
    </div>
  );

  const emptyBox = <div className="rounded-lg border border-border py-6 text-center text-sm text-muted">{t('empty')}</div>;
  const headCls = 'mb-2 text-sm font-medium uppercase tracking-wide text-muted';

  const breakdown = (
    title: string,
    rows: CountRevenue[],
    label: (v: string) => string,
    lostKey?: string,
  ) => {
    const max = Math.max(1, ...rows.map((r) => r.count));
    return (
      <div>
        <h3 className={headCls}>{title}</h3>
        {rows.length === 0 ? (
          emptyBox
        ) : (
          <div className="space-y-2 rounded-lg border border-border p-3">
            {rows.map((r) => {
              const lost = r.key === lostKey;
              return (
                <div key={r.key}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="truncate">{label(r.key)}</span>
                    <span className={`ml-2 shrink-0 tabular-nums ${lost ? 'text-red-500/70' : 'text-muted'}`}>
                      {r.count} · {money(r.revenue)}{lost ? ` · ${t('lost')}` : ''}
                    </span>
                  </div>
                  {bar(r.count / max)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const maxResRev = Math.max(1, ...resRows.map((r) => r.revenue));
  const maxAddonRev = Math.max(1, ...addonRows.map((a) => a.revenue));

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>
        <div className="inline-flex flex-wrap rounded-md border border-border p-0.5">
          {presetBtn('today', t('period.today'))}
          {presetBtn('week', t('period.week'))}
          {presetBtn('month', t('period.month'))}
          {presetBtn('30d', t('period.last30'))}
          {presetBtn('all', t('period.all'))}
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {label: t('kpi.bookings'), value: k.count.toLocaleString()},
          {label: t('kpi.revenue'), value: money(k.revenue)},
          {label: t('kpi.avgCheck'), value: money(k.avgCheck)},
          {label: t('kpi.guests'), value: k.guests.toLocaleString()},
        ].map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs text-muted">{c.label}</div>
            <div className="mt-1 text-lg font-semibold tracking-tight">{c.value}</div>
          </div>
        ))}
      </div>

      {/* По VIP-объектам */}
      <section className="mt-6">
        <h2 className={headCls}>{t('byResource')}</h2>
        {resRows.length === 0 ? (
          emptyBox
        ) : (
          <div className="space-y-2 rounded-lg border border-border p-3">
            {resRows.map((r) => (
              <div key={r.key}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{backgroundColor: rMap.get(r.key)?.color}} />
                    <span className="truncate font-medium">{rName(r.key)}</span>
                  </span>
                  <span className="ml-2 shrink-0 tabular-nums text-muted">{r.count} · {money(r.revenue)}</span>
                </div>
                {bar(r.revenue / maxResRev, rMap.get(r.key)?.color)}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Разбивки */}
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        {breakdown(t('byStatus'), statusRows, (v) => ts(v), 'CANCELLED')}
        {breakdown(t('bySource'), sourceRows, (v) => tsrc(v))}
        {breakdown(t('byTariff'), tariffRows, (v) => tt(v))}
      </section>

      {/* Топ-клиенты */}
      <section className="mt-6">
        <h2 className={headCls}>{t('topClients')}</h2>
        {top.length === 0 ? (
          emptyBox
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {top.map((c) => (
              <Link key={c.clientId} href={`/clients/${c.clientId}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-subtle">
                <span className="flex-1 truncate font-medium">{cMap.get(c.clientId)?.name ?? c.clientId}</span>
                <span className="shrink-0 tabular-nums text-muted">{c.count} · {money(c.revenue)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Доп.услуги */}
      <section className="mt-6">
        <h2 className={headCls}>{t('addons')}</h2>
        {addonRows.length === 0 ? (
          emptyBox
        ) : (
          <div className="space-y-2 rounded-lg border border-border p-3">
            {addonRows.map((a) => (
              <div key={a.addonId}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="truncate">{aName(a.addonId)}</span>
                  <span className="ml-2 shrink-0 tabular-nums text-muted">× {a.qty} · {money(a.revenue)}</span>
                </div>
                {bar(a.revenue / maxAddonRev)}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
