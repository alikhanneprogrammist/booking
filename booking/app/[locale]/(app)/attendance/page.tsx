import {setRequestLocale} from 'next-intl/server';
import AttendanceView from '@/components/attendance/AttendanceView';
import {getBookingsStartingBetween, getAttendanceArchive} from '@/lib/queries';
import {addDays, weekStart, shiftAnchor, shiftStart, almatyDayStart} from '@/lib/calendar';
import {toAlmaty} from '@/lib/time';

export const dynamic = 'force-dynamic';

const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;

// Вкладка «Посещаемость» — недельный анализ по источникам (как эксель
// «Недельный Анализ Посещаемости»), строится автоматически из броней.
// День заезда = смена 10:00→10:00 (как в календаре).
export default async function AttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{w?: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  const sp = await searchParams;
  const anchor = WEEK_RE.test(sp.w ?? '') ? new Date(`${sp.w}T12:00:00`) : shiftStart(new Date());
  const ws = weekStart(almatyDayStart(Number.isNaN(anchor.getTime()) ? new Date() : anchor));

  // Архив хранит понедельник недели стеночной датой (UTC-полночь, @db.Date).
  const w = toAlmaty(ws);
  const archiveKey = new Date(Date.UTC(w.getFullYear(), w.getMonth(), w.getDate()));

  // Брони текущей и прошлой недели — по границам СМЕН (пн 10:00 … пн 10:00).
  const [bookings, prevBookings, archive] = await Promise.all([
    getBookingsStartingBetween(shiftAnchor(ws), shiftAnchor(addDays(ws, 7))),
    getBookingsStartingBetween(shiftAnchor(addDays(ws, -7)), shiftAnchor(ws)),
    getAttendanceArchive(archiveKey),
  ]);

  return (
    <div className="h-screen overflow-auto">
      <AttendanceView
        bookings={bookings}
        prevBookings={prevBookings}
        archive={archive}
        weekStartIso={ws.toISOString()}
      />
    </div>
  );
}
