-- Убираем фичу официантов: FK, индекс, колонку и таблицу.
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_waiterId_fkey";
DROP INDEX "Booking_waiterId_idx";
ALTER TABLE "Booking" DROP COLUMN "waiterId";
DROP TABLE "Waiter";
