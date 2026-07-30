import {setRequestLocale} from 'next-intl/server';
import TimesheetView from '@/components/timesheet/TimesheetView';
import {getTimesheetMonth} from '@/lib/queries';
import {currentUser} from '@/lib/auth-helpers';
import {parseMonthParam} from '@/lib/timesheet';
import {toAlmaty} from '@/lib/time';

export const dynamic = 'force-dynamic';

// Вкладка «Табель» — учёт рабочего времени план/факт (как эксель
// «Табель План-Факт»): сотрудники по отделам × дни месяца, в ячейке — часы.
export default async function TimesheetPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{m?: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  const sp = await searchParams;
  const now = toAlmaty(new Date());
  const {year, month} = parseMonthParam(sp.m, {year: now.getFullYear(), month: now.getMonth() + 1});

  const [employees, user] = await Promise.all([getTimesheetMonth(year, month), currentUser()]);

  // Сегодняшний день Алматы — подсветка колонки текущего месяца.
  const today =
    now.getFullYear() === year && now.getMonth() + 1 === month ? now.getDate() : null;

  return (
    <div className="h-screen overflow-auto">
      <TimesheetView
        employees={employees}
        year={year}
        month={month}
        today={today}
        isAdmin={user?.role === 'ADMIN'}
      />
    </div>
  );
}
