-- CreateIndex
CREATE INDEX "Booking_createdById_idx" ON "Booking"("createdById");

-- CreateIndex
CREATE INDEX "BookingAddon_bookingId_idx" ON "BookingAddon"("bookingId");

-- CreateIndex
CREATE INDEX "BookingAddon_addonId_idx" ON "BookingAddon"("addonId");
