-- CreateEnum
CREATE TYPE "BookingAuditAction" AS ENUM ('CREATE', 'UPDATE', 'CANCEL');

-- CreateTable
CREATE TABLE "BookingAudit" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "BookingAuditAction" NOT NULL,
    "changes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingAudit_bookingId_createdAt_idx" ON "BookingAudit"("bookingId", "createdAt");

-- AddForeignKey
ALTER TABLE "BookingAudit" ADD CONSTRAINT "BookingAudit_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAudit" ADD CONSTRAINT "BookingAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
