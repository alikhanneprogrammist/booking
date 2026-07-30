'use client';

import {useMemo, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {saveTimesheetCell} from '@/lib/actions';
import {TIMESHEET_DEPARTMENTS} from '@/lib/enums';
import {
  headcount, monthDays, monthParam, rowTotals, shiftMonth,
  type TimesheetEmployee, type TimesheetMode,
} from '@/lib/timesheet';
import EmployeeDialog from './EmployeeDialog';

const pad = (n: number) => String(n).padStart(2, '0');

// Ширины липких колонок (№ + сотрудник) — фиксированы, чтобы вторая
// корректно «прилипала» сразу за первой при горизонтальном скролле.
const COL_NUM = 36;
const COL_NAME = 208;

// Вкладка «Табель» — план/факт учёта рабочего времени (как эксель «Табель
// План-Факт»): строки — сотрудники по отделам, колонки — дни месяца,
// в ячейке — часы смены. Клик по ячейке — правка, клик по имени — карточка.
export default function TimesheetView({
  employees, year, month, today, isAdmin,
}: {
  employees: TimesheetEmployee[];
  year: number;
  month: number;
  today: number | null; // сегодняшний день Алматы, если показан текущий месяц
  isAdmin: boolean;
}) {
  const t = useTranslations('timesheet');
  const locale = useLocale();
  const router = useRouter();
  const intl = locale === 'kk' ? 'kk-KZ' : 'ru-RU';

  const [mode, setMode] = useState<TimesheetMode>('fact');
  const [dialog, setDialog] = useState<{employee?: TimesheetEmployee} | null>(null);
  const [editing, setEditing] = useState<{empId: string; day: number} | null>(null);
  // Оптимистичные правки ячеек поверх серверных данных: `${empId}:${day}:${mode}`.
  const [overrides, setOverrides] = useState<Record<string, number | null>>({});

  const days = useMemo(() => monthDays(year, month), [year, month]);

  const monthTitle = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(intl, {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  });
  const weekdayShort = (day: number) =>
    new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(intl, {
      weekday: 'short', timeZone: 'UTC',
    });

  // Данные с наложенными оптимистичными правками.
  const rows = useMemo(() => {
    return employees.map((e) => {
      const plan = {...e.plan};
      const fact = {...e.fact};
      for (const [key, val] of Object.entries(overrides)) {
        const [empId, dayStr, m] = key.split(':');
        if (empId !== e.id) continue;
        const target = m === 'plan' ? plan : fact;
        if (val === null) delete target[Number(dayStr)];
        else target[Number(dayStr)] = val;
      }
      return {...e, plan, fact};
    });
  }, [employees, overrides]);

  // Группы по отделам в порядке TIMESHEET_DEPARTMENTS (пустые не показываем);
  // отделы вне списка на всякий случай попадают в «Прочее».
  const groups = useMemo(() => {
    const known = new Set<string>(TIMESHEET_DEPARTMENTS);
    return TIMESHEET_DEPARTMENTS
      .map((dept) => ({
        dept,
        rows: rows.filter((r) =>
          dept === 'OTHER' ? r.department === 'OTHER' || !known.has(r.department) : r.department === dept),
      }))
      .filter((g) => g.rows.length > 0);
  }, [rows]);

  const flatRows = groups.flatMap((g) => g.rows);
  const grandTotals = flatRows.reduce(
    (acc, r) => {
      const tot = rowTotals(r[mode]);
      return {days: acc.days + tot.days, hours: acc.hours + tot.hours};
    },
    {days: 0, hours: 0},
  );
  const dayHeadcount = (day: number) => headcount(flatRows, mode, day);

  const goMonth = (delta: number) => {
    const next = shiftMonth(year, month, delta);
    router.replace(`/timesheet?m=${monthParam(next.year, next.month)}`);
  };

  async function commitCell(emp: TimesheetEmployee, day: number, raw: string) {
    setEditing(null);
    const trimmed = raw.trim();
    const hours = trimmed === '' ? null : Math.round(Number(trimmed));
    if (hours !== null && (!Number.isFinite(hours) || hours < 1 || hours > 24)) return;
    if ((emp[mode][day] ?? null) === hours) return; // ничего не поменялось

    const key = `${emp.id}:${day}:${mode}`;
    setOverrides((o) => ({...o, [key]: hours}));
    const res = await saveTimesheetCell({
      employeeId: emp.id,
      date: `${year}-${pad(month)}-${pad(day)}`,
      mode,
      hours,
    });
    if (!res.ok) {
      // Откат оптимистичной правки — сервер отказал.
      setOverrides((o) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== key)));
      return;
    }
    router.refresh();
  }

  // Эксель-выгрузка: листы «План» и «Факт» месяца в общем стиле выгрузок.
  async function downloadReport() {
    const {newWorkbook, addTitle, addHeader, addDataRow, addTotalRow, saveWorkbook} =
      await import('@/lib/excel');
    const wb = await newWorkbook();

    for (const m of ['plan', 'fact'] as const) {
      const ws = wb.addWorksheet(t(m));
      const width = 6 + days.length + 2;
      addTitle(ws, `${t('title')} ${monthTitle} — ${t(m)}`, width);
      const header = addHeader(ws, [
        '№', t('name'), t('position'), t('schedule'), t('shiftHoursShort'), t('workPatternShort'),
        ...days.map((d) => d.day), t('daysTotal'), t('hoursTotal'),
      ]);
      // Выходные пт/сб — тёплая заливка в шапке (как подсветка в таблице).
      days.forEach((d, i) => {
        if (d.isWeekend) {
          header.getCell(7 + i).fill =
            {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FF92650F'}};
        }
      });

      let n = 0;
      for (const g of groups) {
        addTotalRow(ws, [t(`dept.${g.dept}`)]);
        for (const r of g.rows) {
          const tot = rowTotals(r[m]);
          addDataRow(ws, [
            ++n, r.name, r.position, r.schedule ?? '', r.shiftHours ?? '', r.workPattern ?? '',
            ...days.map((d) => r[m][d.day] ?? ''), tot.days, tot.hours,
          ], n % 2 === 0);
        }
      }
      const totals = flatRows.reduce(
        (acc, r) => {
          const tot = rowTotals(r[m]);
          return {days: acc.days + tot.days, hours: acc.hours + tot.hours};
        },
        {days: 0, hours: 0},
      );
      addTotalRow(ws, [
        t('inShift'), '', '', '', '', '',
        ...days.map((d) => headcount(flatRows, m, d.day)),
        totals.days, totals.hours,
      ]);
      ws.columns = [
        {width: 4}, {width: 24}, {width: 18}, {width: 18}, {width: 7}, {width: 7},
        ...days.map(() => ({width: 4.5})), {width: 7}, {width: 8},
      ];
      ws.views = [{state: 'frozen', xSplit: 2, ySplit: 2}];
    }

    await saveWorkbook(wb, `${t('title')} ${monthParam(year, month)}.xlsx`);
  }

  const dayBg = (d: {day: number; isWeekend: boolean}) =>
    d.day === today
      ? 'bg-primary/10'
      : d.isWeekend
        ? 'bg-amber-50 dark:bg-amber-950/20'
        : '';

  return (
    <div className="p-4 md:p-6">
      {/* Шапка: месяц, план/факт, действия */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>

        <div className="flex items-center gap-1">
          <button onClick={() => goMonth(-1)} aria-label="prev"
            className="rounded-md border border-border px-2 py-1 text-sm hover:bg-subtle">‹</button>
          <span className="min-w-32 text-center text-sm font-medium capitalize">{monthTitle}</span>
          <button onClick={() => goMonth(1)} aria-label="next"
            className="rounded-md border border-border px-2 py-1 text-sm hover:bg-subtle">›</button>
        </div>

        <div className="flex overflow-hidden rounded-md border border-border text-sm">
          {(['plan', 'fact'] as const).map((m) => (
            <button key={m} onClick={() => { setMode(m); setEditing(null); }}
              className={`px-3 py-1.5 ${mode === m ? 'bg-primary text-primary-foreground' : 'hover:bg-subtle'}`}>
              {t(m)}
            </button>
          ))}
        </div>

        <div className="ml-auto flex gap-2">
          <button onClick={downloadReport}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-subtle">
            {t('export')}
          </button>
          <button onClick={() => setDialog({})}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
            {t('addEmployee')}
          </button>
        </div>
      </div>

      {mode === 'fact' && (
        <p className="mb-3 text-xs text-muted">{t('factHint')}</p>
      )}

      {flatRows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted">
          {t('empty')}
        </div>
      ) : (
        <div className="overflow-auto rounded-xl border border-border bg-card">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="sticky top-0 z-20">
                <th className="sticky left-0 z-30 border-b border-r border-border bg-card px-2 py-2 text-xs font-medium text-muted"
                  style={{minWidth: COL_NUM}}>№</th>
                <th className="sticky z-30 border-b border-r border-border bg-card px-3 py-2 text-left text-xs font-medium text-muted"
                  style={{left: COL_NUM, minWidth: COL_NAME}}>{t('employee')}</th>
                {days.map((d) => (
                  <th key={d.day}
                    className={`border-b border-r border-border bg-card px-0 py-1 text-center align-bottom ${dayBg(d)}`}
                    style={{minWidth: 34}}>
                    <div className="text-[13px] font-semibold leading-tight">{d.day}</div>
                    <div className={`text-[10px] font-normal leading-tight ${d.isWeekend ? 'text-amber-600 dark:text-amber-500' : 'text-muted'}`}>
                      {weekdayShort(d.day)}
                    </div>
                  </th>
                ))}
                <th className="border-b border-r border-border bg-card px-2 py-2 text-xs font-medium text-muted" style={{minWidth: 44}}>{t('daysTotal')}</th>
                <th className="border-b border-border bg-card px-2 py-2 text-xs font-medium text-muted" style={{minWidth: 52}}>{t('hoursTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                let n = 0;
                return groups.map((g) => (
                  <FragmentGroup key={g.dept} label={t(`dept.${g.dept}`)} colSpan={2 + days.length + 2}>
                    {g.rows.map((r) => {
                      n += 1;
                      const tot = rowTotals(r[mode]);
                      const meta = [r.position, r.schedule, r.workPattern && `${t('workPatternShort')} ${r.workPattern}`]
                        .filter(Boolean).join(' · ');
                      return (
                        <tr key={r.id} className={`group ${r.isActive ? '' : 'opacity-50'}`}>
                          <td className="sticky left-0 z-10 border-b border-r border-border bg-card px-2 py-1 text-center text-xs text-muted">{n}</td>
                          <td className="sticky z-10 cursor-pointer border-b border-r border-border bg-card px-3 py-1 hover:bg-subtle"
                            style={{left: COL_NUM, maxWidth: 280}}
                            onClick={() => setDialog({employee: r})} title={meta}>
                            <div className="truncate font-medium leading-tight">
                              {r.name}
                              {!r.isActive && <span className="ml-1 text-xs font-normal text-muted">({t('hidden')})</span>}
                            </div>
                            <div className="truncate text-[11px] leading-tight text-muted">{meta}</div>
                          </td>
                          {days.map((d) => {
                            const val = r[mode][d.day];
                            const ghost = mode === 'fact' && val === undefined ? r.plan[d.day] : undefined;
                            const isEditing = editing?.empId === r.id && editing.day === d.day;
                            return (
                              <td key={d.day}
                                className={`border-b border-r border-border p-0 text-center ${dayBg(d)}`}>
                                {isEditing ? (
                                  <input
                                    autoFocus
                                    inputMode="numeric"
                                    defaultValue={val ?? ghost ?? r.shiftHours ?? ''}
                                    onFocus={(e) => e.target.select()}
                                    onBlur={(e) => commitCell(r, d.day, e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                      if (e.key === 'Escape') setEditing(null);
                                    }}
                                    className="h-8 w-full border-0 bg-primary/10 text-center text-sm outline-none ring-1 ring-primary"
                                  />
                                ) : (
                                  <button
                                    onClick={() => setEditing({empId: r.id, day: d.day})}
                                    className="h-8 w-full cursor-pointer hover:bg-subtle"
                                    title={`${d.day} ${monthTitle}`}
                                  >
                                    {val !== undefined ? (
                                      <span className="font-medium">{val}</span>
                                    ) : ghost !== undefined ? (
                                      <span className="text-muted/60">{ghost}</span>
                                    ) : null}
                                  </button>
                                )}
                              </td>
                            );
                          })}
                          <td className="border-b border-r border-border px-2 py-1 text-center text-xs font-medium">{tot.days || ''}</td>
                          <td className="border-b border-border px-2 py-1 text-center text-xs font-semibold">{tot.hours || ''}</td>
                        </tr>
                      );
                    })}
                  </FragmentGroup>
                ));
              })()}

              {/* Итог: человек в смене по каждому дню */}
              <tr className="bg-subtle/60 font-medium">
                <td className="sticky left-0 z-10 border-r border-border bg-subtle px-2 py-1" />
                <td className="sticky z-10 border-r border-border bg-subtle px-3 py-1.5 text-xs" style={{left: COL_NUM}}>
                  {t('inShift')}
                </td>
                {days.map((d) => (
                  <td key={d.day} className={`border-r border-border px-0 py-1.5 text-center text-xs ${dayBg(d)}`}>
                    {dayHeadcount(d.day) || ''}
                  </td>
                ))}
                <td className="border-r border-border px-2 py-1.5 text-center text-xs">{grandTotals.days}</td>
                <td className="px-2 py-1.5 text-center text-xs font-semibold">{grandTotals.hours}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {dialog && (
        <EmployeeDialog employee={dialog.employee} isAdmin={isAdmin} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

// Подзаголовок отдела + его строки (нельзя обернуть <tr> в div внутри tbody).
function FragmentGroup({label, colSpan, children}: {
  label: string;
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <>
      <tr>
        <td colSpan={colSpan}
          className="border-b border-border bg-subtle px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          {label}
        </td>
      </tr>
      {children}
    </>
  );
}
