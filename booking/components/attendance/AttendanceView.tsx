'use client';

import {useMemo} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {toAlmaty} from '@/lib/time';
import {addDays, shiftAnchor, shiftStart} from '@/lib/calendar';
import {BOOKING_SOURCES} from '@/lib/enums';
import type {MockBooking} from '@/lib/types';

type ArchiveRow = {source: string; count: number; amount?: number};

// «Посещаемость» — недельная таблица день × источник, автоматически из броней
// (как эксель «Недельный Анализ Посещаемости»). День = смена 10:00→10:00.
export default function AttendanceView({
  bookings, prevBookings, archive, weekStartIso,
}: {
  bookings: MockBooking[];
  prevBookings: MockBooking[];
  archive: ArchiveRow[];
  weekStartIso: string;
}) {
  const t = useTranslations('attendance');
  const tsrc = useTranslations('source');
  const locale = useLocale();
  const router = useRouter();

  const ws = new Date(weekStartIso);
  const intl = locale === 'kk' ? 'kk-KZ' : 'ru-RU';
  const money = (n: number) => `${Math.round(n).toLocaleString(locale)} ₸`;
  const fmtShort = (d: Date) => toAlmaty(d).toLocaleDateString(intl, {day: '2-digit', month: '2-digit'});
  const fmtDate = (d: Date) => toAlmaty(d).toLocaleDateString(intl, {day: '2-digit', month: '2-digit', year: 'numeric'});
  const weekdayName = (d: Date) => toAlmaty(d).toLocaleDateString(intl, {weekday: 'long'});
  const weekLabel = `${fmtShort(ws)} – ${fmtDate(addDays(ws, 6))}`;

  const shift = (delta: number) => {
    const w = toAlmaty(addDays(ws, delta * 7));
    const p = (n: number) => String(n).padStart(2, '0');
    router.replace(`/attendance?w=${w.getFullYear()}-${p(w.getMonth() + 1)}-${p(w.getDate())}`);
  };

  const srcLabel = (s: string) =>
    (BOOKING_SOURCES as readonly string[]).includes(s) ? tsrc(s) : s;

  // Заезды = брони без отменённых/неявок; день заезда — по смене 10:00→10:00.
  const {counts, sums, totals} = useMemo(() => {
    const counts = Array.from({length: 7}, () => new Map<string, number>());
    const sums = Array.from({length: 7}, () => new Map<string, number>());
    const anchor = shiftAnchor(ws).getTime();
    for (const b of bookings) {
      if (b.status === 'CANCELLED' || b.status === 'NO_SHOW') continue;
      const day = Math.floor((shiftStart(b.startAt).getTime() - anchor) / 86_400_000);
      if (day < 0 || day > 6) continue;
      counts[day].set(b.source, (counts[day].get(b.source) ?? 0) + 1);
      sums[day].set(b.source, (sums[day].get(b.source) ?? 0) + b.total);
    }
    const totals = {
      bySource: new Map<string, {count: number; sum: number}>(),
      byDay: Array.from({length: 7}, (_, i) => ({
        count: Array.from(counts[i].values()).reduce((s, n) => s + n, 0),
        sum: Array.from(sums[i].values()).reduce((s, n) => s + n, 0),
      })),
    };
    for (let i = 0; i < 7; i++) {
      for (const [src, n] of Array.from(counts[i].entries())) {
        const cur = totals.bySource.get(src) ?? {count: 0, sum: 0};
        cur.count += n;
        cur.sum += sums[i].get(src) ?? 0;
        totals.bySource.set(src, cur);
      }
    }
    return {counts, sums, totals};
  }, [bookings, weekStartIso]);

  // Прошлая неделя — итоги по источникам (для строки сравнения).
  const prevBySource = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of prevBookings) {
      if (b.status === 'CANCELLED' || b.status === 'NO_SHOW') continue;
      m.set(b.source, (m.get(b.source) ?? 0) + 1);
    }
    return m;
  }, [prevBookings]);

  const weekCount = totals.byDay.reduce((s, d) => s + d.count, 0);
  const weekSum = totals.byDay.reduce((s, d) => s + d.sum, 0);
  const prevCount = Array.from(prevBySource.values()).reduce((s, n) => s + n, 0);
  const prevSum = prevBookings
    .filter((b) => b.status !== 'CANCELLED' && b.status !== 'NO_SHOW')
    .reduce((s, b) => s + b.total, 0);

  // Колонки: все источники системы; чужие подписи из архива добавляются в конец.
  const columns: string[] = [
    ...BOOKING_SOURCES,
    ...archive.map((a) => a.source).filter((s) => !(BOOKING_SOURCES as readonly string[]).includes(s)),
  ];

  const days = Array.from({length: 7}, (_, i) => addDays(ws, i));

  // Выгрузка недели в .xlsx — формат эксель-файла посещаемости.
  async function downloadXlsx() {
    const XLSX = await import('xlsx');
    const header = [t('date'), t('weekday'), ...columns.map(srcLabel), t('total')];
    const dayRows = days.map((d, i) => [
      fmtDate(d),
      weekdayName(d),
      ...columns.map((c) => counts[i].get(c) || ''),
      totals.byDay[i].count || '',
    ]);
    const aoa = [
      [t('title')],
      header,
      ...dayRows,
      [t('total'), '', ...columns.map((c) => totals.bySource.get(c)?.count ?? 0), weekCount],
      [t('totalSum'), '', ...columns.map((c) => Math.round(totals.bySource.get(c)?.sum ?? 0)), Math.round(weekSum)],
      [t('prevWeekRow'), '', ...columns.map((c) => prevBySource.get(c) ?? 0), prevCount],
    ];
    if (archive.length) {
      aoa.push([]);
      aoa.push([t('archiveTitle'), '', ...columns.map((c) => archive.find((a) => a.source === c)?.count ?? '')]);
    }
    const ws2 = XLSX.utils.aoa_to_sheet(aoa);
    ws2['!cols'] = [{wch: 12}, {wch: 13}, ...columns.map(() => ({wch: 12})), {wch: 9}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws2, weekLabel.replaceAll('–', '-'));
    XLSX.writeFile(wb, `${t('fileName')}-${weekLabel.replaceAll(' ', '').replaceAll('–', '-')}.xlsx`);
  }

  const cellCls = 'whitespace-nowrap px-2 py-1.5 text-center tabular-nums';

  return (
    <div className="mx-auto max-w-full p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} aria-label="prev"
            className="rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-subtle">‹</button>
          <span className="min-w-44 px-2 text-center text-sm font-medium">{weekLabel}</span>
          <button onClick={() => shift(1)} aria-label="next"
            className="rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-subtle">›</button>
          <button onClick={downloadXlsx}
            className="ml-2 rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-subtle">
            ⬇ {t('download')}
          </button>
        </div>
      </div>

      {/* Итоги недели */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:max-w-2xl">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted">{t('countWeek')}</div>
          <div className="mt-0.5 text-lg font-semibold">{weekCount}</div>
          <div className="mt-0.5 text-xs text-muted">{t('prevWeek')}: {prevCount}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted">{t('revenueWeek')}</div>
          <div className="mt-0.5 text-lg font-semibold">{money(weekSum)}</div>
          <div className="mt-0.5 text-xs text-muted">{t('prevWeek')}: {money(prevSum)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted">{t('avgCheck')}</div>
          <div className="mt-0.5 text-lg font-semibold">{weekCount ? money(weekSum / weekCount) : '—'}</div>
          <div className="mt-0.5 text-xs text-muted">
            {t('prevWeek')}: {prevCount ? money(prevSum / prevCount) : '—'}
          </div>
        </div>
      </div>

      {/* Матрица день × источник (кол-во заездов; сумма — в тултипе ячейки) */}
      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="whitespace-nowrap px-3 py-2">{t('date')}</th>
              {columns.map((c) => (
                <th key={c} className="whitespace-nowrap px-2 py-2 text-center">{srcLabel(c)}</th>
              ))}
              <th className="whitespace-nowrap px-2 py-2 text-center">{t('total')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {days.map((d, i) => (
              <tr key={i}>
                <td className="whitespace-nowrap px-3 py-1.5">
                  {fmtShort(d)} <span className="text-xs text-muted">{weekdayName(d)}</span>
                </td>
                {columns.map((c) => {
                  const n = counts[i].get(c) ?? 0;
                  const s = sums[i].get(c) ?? 0;
                  return (
                    <td key={c} className={`${cellCls} ${n ? 'font-medium' : 'text-muted/40'}`}
                      title={n ? `${srcLabel(c)}: ${n} · ${money(s)}` : undefined}>
                      {n || '·'}
                    </td>
                  );
                })}
                <td className={`${cellCls} font-semibold`}>{totals.byDay[i].count || '·'}</td>
              </tr>
            ))}
            <tr className="bg-subtle/60 font-medium">
              <td className="px-3 py-1.5">{t('total')}</td>
              {columns.map((c) => (
                <td key={c} className={cellCls}>{totals.bySource.get(c)?.count ?? 0}</td>
              ))}
              <td className={`${cellCls} font-semibold`}>{weekCount}</td>
            </tr>
            <tr className="text-xs text-muted">
              <td className="px-3 py-1.5">{t('totalSum')}</td>
              {columns.map((c) => {
                const s = totals.bySource.get(c)?.sum ?? 0;
                return <td key={c} className={cellCls}>{s ? Math.round(s / 1000).toLocaleString(locale) + 'к' : '·'}</td>;
              })}
              <td className={cellCls}>{Math.round(weekSum / 1000).toLocaleString(locale)}к</td>
            </tr>
            <tr className="text-xs text-muted">
              <td className="px-3 py-1.5">{t('prevWeekRow')}</td>
              {columns.map((c) => (
                <td key={c} className={cellCls}>{prevBySource.get(c) ?? 0}</td>
              ))}
              <td className={cellCls}>{prevCount}</td>
            </tr>
            {/* Архив из экселя (недели до запуска системы) */}
            {archive.length > 0 && (
              <tr className="bg-amber-50/50 text-xs dark:bg-amber-950/20">
                <td className="px-3 py-1.5" title={t('archiveHint')}>{t('archiveTitle')}</td>
                {columns.map((c) => {
                  const a = archive.find((x) => x.source === c);
                  return (
                    <td key={c} className={cellCls} title={a?.amount ? money(a.amount) : undefined}>
                      {a?.count ?? '·'}
                    </td>
                  );
                })}
                <td className={`${cellCls} font-medium`}>{archive.reduce((s, a) => s + a.count, 0)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
