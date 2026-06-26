-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "minBookingHours" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "prepaymentPercent" INTEGER NOT NULL DEFAULT 0;
