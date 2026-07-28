-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BookingSource" ADD VALUE 'YANDEX';
ALTER TYPE "BookingSource" ADD VALUE 'MUKBANG';

-- CreateTable
CREATE TABLE "AttendanceArchive" (
    "id" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "source" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "amount" INTEGER,

    CONSTRAINT "AttendanceArchive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceArchive_weekStart_idx" ON "AttendanceArchive"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceArchive_weekStart_source_key" ON "AttendanceArchive"("weekStart", "source");
