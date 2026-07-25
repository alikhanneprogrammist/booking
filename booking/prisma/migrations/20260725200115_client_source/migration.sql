-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "source" "BookingSource";

-- Бэкфилл: источник клиента = источник его самой ранней брони (по startAt).
UPDATE "Client" c
SET "source" = (
  SELECT b."source"
  FROM "Booking" b
  WHERE b."clientId" = c."id"
  ORDER BY b."startAt" ASC
  LIMIT 1
)
WHERE c."source" IS NULL;
