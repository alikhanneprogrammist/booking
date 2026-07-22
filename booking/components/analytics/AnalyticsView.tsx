'use client';

import {useMemo, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Link, useRouter} from '@/i18n/navigation';
import type {MockBooking, MockResource, MockClient, MockAddon, DeliveryOrder} from '@/lib/types';
import {
  kpis, byResource, byEnum, topClients, addonStats,
  prepaymentTotal, byPayment, byDay, pointsByDay, toMonthly, byWeekday,
  type CountRevenue,
} from '@/lib/analytics';
import {sectionHead} from '@/lib/ui';

export type Preset = 'today' | 'week' | 'month' | '30d' | 'custom';

export default function AnalyticsView({
  bookings, prepaid, resources, clients, addons, delivery, preset, rangeFrom, rangeTo,
}: {
  bookings: MockBooking[]; // уже отфильтрованы по периоду на сервере (без импортных нулевой длительности)
  prepaid: MockBooking[]; // предоплаты периода по дате получения денег (вкл. импортированную историю)
  resources: MockResource[];
  clients: MockClient[];
  addons: MockAddon[];
  delivery: DeliveryOrder[]; // заказы внутренней доставки периода (вкладка «Доставка»)
  preset: Preset;
  rangeFrom: string; // активный диапазон YYYY-MM-DD (конец включительно) —
  rangeTo: string; //   начальные значения полей выбора произвольного периода
}) {
  const t = useTranslations('analytics');
  const ts = useTranslations('status');
  const tsrc = useTranslations('source');
  const tpm = useTranslations('payment');
  const locale = useLocale();
  const router = useRouter();

  // Произвольный период «с … по …» (замена неограниченного «Всё время»).
  const [from, setFrom] = useState(rangeFrom);
  const [to, setTo] = useState(rangeTo);
  const applyCustom = () => {
    if (from && to) router.replace(`/analytics?p=custom&from=${from}&to=${to}`);
  };

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
  // Явная локаль: сервер и браузер обязаны форматировать одинаково (иначе hydration mismatch).
  // Округляем до тенге — копейки в выручке только шумят.
  const money = (n: number) => `${Math.round(n).toLocaleString(locale)} ₸`;

  // Отменённые и неявки исключаем везде, кроме разбивки по статусам:
  // денег по ним нет — это «упущенная» выручка, не фактическая/ожидаемая.
  const active = useMemo(
    () => bookings.filter((b) => b.status !== 'CANCELLED' && b.status !== 'NO_SHOW'),
    [bookings],
  );

  const k = useMemo(() => kpis(active), [active]);
  const resRows = useMemo(() => byResource(active), [active]);
  const statusRows = useMemo(() => byEnum(bookings, 'status'), [bookings]);
  const sourceRows = useMemo(() => byEnum(active, 'source'), [active]);
  const top = useMemo(() => topClients(active, 5), [active]);
  const addonRows = useMemo(() => addonStats(active), [active]);
  const paymentRows = useMemo(() => byPayment(prepaid), [prepaid]);
  const weekdayRows = useMemo(() => byWeekday(active), [active]);
  // Динамика: по дням; длинные периоды (>92 дней) сворачиваем помесячно.
  const series = useMemo(() => {
    const days = byDay(active, rangeFrom, rangeTo);
    return days.length > 92 ? toMonthly(days) : days;
  }, [active, rangeFrom, rangeTo]);
  const maxSeries = Math.max(1, ...series.map((d) => d.revenue));

  // Доставка: KPI и динамика. Строка журнала = день из экселя (может содержать
  // несколько заказов), поэтому «средний чек» — по строкам журнала.
  const dlv = useMemo(() => {
    const amount = delivery.reduce((s, o) => s + o.amount, 0);
    const courier = delivery.reduce((s, o) => s + (o.courierCost ?? 0), 0);
    return {count: delivery.length, amount, courier, avg: delivery.length ? amount / delivery.length : 0};
  }, [delivery]);
  const dlvSeries = useMemo(() => {
    const days = pointsByDay(delivery.map((o) => ({at: o.date, value: o.amount})), rangeFrom, rangeTo);
    return days.length > 92 ? toMonthly(days) : days;
  }, [delivery, rangeFrom, rangeTo]);
  const maxDlvSeries = Math.max(1, ...dlvSeries.map((d) => d.revenue));

  // Метка дня недели по ключу getDay() ('0'=вс): 2026-07-12 — воскресенье.
  const weekdayLabel = (k: string) =>
    new Date(Date.UTC(2026, 6, 12 + Number(k))).toLocaleDateString(
      locale === 'kk' ? 'kk-KZ' : 'ru-RU',
      {weekday: 'long', timeZone: 'UTC'},
    );

  const presetBtn = (p: Preset, label: string) => (
    <button
      onClick={() => router.replace(`/analytics?p=${p}`)}
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
  const headCls = sectionHead;

  const breakdown = (
    title: string,
    rows: CountRevenue[],
    label: (v: string) => string,
    lostKeys?: string[],
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
              const lost = lostKeys?.includes(r.key) ?? false;
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
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap rounded-md border border-border p-0.5">
            {presetBtn('today', t('period.today'))}
            {presetBtn('week', t('period.week'))}
            {presetBtn('month', t('period.month'))}
            {presetBtn('30d', t('period.last30'))}
          </div>
          {/* Произвольный период */}
          <div className={`inline-flex items-center gap-1 rounded-md border p-0.5 ${
            preset === 'custom' ? 'border-primary' : 'border-border'
          }`}>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded bg-transparent px-1.5 py-0.5 text-sm outline-none"
            />
            <span className="text-muted">–</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded bg-transparent px-1.5 py-0.5 text-sm outline-none"
            />
            <button
              onClick={applyCustom}
              disabled={!from || !to}
              className={`rounded px-2.5 py-1 text-sm font-medium disabled:opacity-50 ${
                preset === 'custom' ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-foreground'
              }`}
            >
              {t('period.apply')}
            </button>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          {label: t('kpi.bookings'), value: k.count.toLocaleString(locale)},
          {label: t('kpi.revenue'), value: money(k.revenue)},
          {label: t('kpi.avgCheck'), value: money(k.avgCheck)},
          {label: t('kpi.guests'), value: k.guests.toLocaleString(locale)},
          {label: t('kpi.prepayments'), value: money(prepaymentTotal(prepaid))},
        ].map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs text-muted">{c.label}</div>
            <div className="mt-1 text-lg font-semibold tracking-tight">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Динамика по дням/месяцам */}
      {series.length > 1 && (
        <section className="mt-6">
          <h2 className={headCls}>{t('dynamics')}</h2>
          <div className="rounded-lg border border-border p-3">
            <div className="flex h-28 items-end gap-px">
              {series.map((d) => (
                <div
                  key={d.day}
                  title={`${d.day}: ${money(d.revenue)} · ${d.count}`}
                  className="flex-1 rounded-t bg-primary/60 transition-colors hover:bg-primary"
                  style={{height: `${Math.max(Math.round((d.revenue / maxSeries) * 100), 2)}%`}}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted">
              <span>{series[0].day}</span>
              <span>{series[series.length - 1].day}</span>
            </div>
          </div>
        </section>
      )}

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
      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        {breakdown(t('byStatus'), statusRows, (v) => ts(v), ['CANCELLED', 'NO_SHOW'])}
        {breakdown(t('bySource'), sourceRows, (v) => tsrc(v))}
      </section>

      {/* Деньги: способы оплаты предоплат + дни недели */}
      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          {breakdown(t('byPayment'), paymentRows, (v) => (v === 'UNKNOWN' ? '—' : tpm(v)))}
          <p className="mt-1 text-[11px] text-muted">{t('paymentNote')}</p>
        </div>
        {breakdown(t('byWeekday'), weekdayRows, weekdayLabel)}
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

      {/* Внутренняя доставка (журнал вкладки «Доставка») */}
      <section className="mt-6">
        <h2 className={headCls}>{t('delivery.title')}</h2>
        {dlv.count === 0 ? (
          emptyBox
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {label: t('delivery.orders'), value: dlv.count.toLocaleString(locale)},
                {label: t('delivery.revenue'), value: money(dlv.amount)},
                {label: t('delivery.avgCheck'), value: money(dlv.avg)},
                {label: t('delivery.courier'), value: money(dlv.courier)},
              ].map((c) => (
                <div key={c.label} className="rounded-lg border border-border bg-card p-3">
                  <div className="text-xs text-muted">{c.label}</div>
                  <div className="mt-1 text-lg font-semibold tracking-tight">{c.value}</div>
                </div>
              ))}
            </div>
            {dlvSeries.length > 1 && (
              <div className="mt-3 rounded-lg border border-border p-3">
                <div className="flex h-28 items-end gap-px">
                  {dlvSeries.map((d) => (
                    <div
                      key={d.day}
                      title={`${d.day}: ${money(d.revenue)} · ${d.count}`}
                      className="flex-1 rounded-t bg-primary/60 transition-colors hover:bg-primary"
                      style={{height: `${Math.max(Math.round((d.revenue / maxDlvSeries) * 100), 2)}%`}}
                    />
                  ))}
                </div>
                <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted">
                  <span>{dlvSeries[0].day}</span>
                  <span>{dlvSeries[dlvSeries.length - 1].day}</span>
                </div>
              </div>
            )}
            <p className="mt-1 text-[11px] text-muted">{t('delivery.note')}</p>
          </>
        )}
      </section>
    </div>
  );
}
