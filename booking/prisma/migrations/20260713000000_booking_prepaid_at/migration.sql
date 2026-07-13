-- Дата получения предоплаты (для бухгалтерии: предзаказ сегодня — бронь в будущем).
ALTER TABLE "Booking" ADD COLUMN "prepaidAt" TIMESTAMPTZ(6);

CREATE INDEX "Booking_prepaidAt_idx" ON "Booking"("prepaidAt");

-- Бэкфилл: существующие предоплаты считаем полученными в день создания брони.
UPDATE "Booking" SET "prepaidAt" = "createdAt" WHERE "prepayment" > 0;
