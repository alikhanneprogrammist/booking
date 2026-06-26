-- Анти-овербукинг на уровне БД (ТЗ §4.6, барьер №3).
-- Один объект (resourceId) не может иметь две активные пересекающиеся брони.
-- Интервалы полуоткрытые [startAt, endAt): касание границами не считается пересечением,
-- что совпадает с барьером приложения в lib/bookings.ts (findOverlap).
-- Отменённые брони (CANCELLED) освобождают время — исключены из ограничения.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking"
  ADD CONSTRAINT booking_no_overlap
  EXCLUDE USING gist (
    "resourceId" WITH =,
    tstzrange("startAt", "endAt", '[)') WITH &&
  )
  WHERE ("status" <> 'CANCELLED');
