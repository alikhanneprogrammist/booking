-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BookingSource" ADD VALUE 'TWO_GIS';
ALTER TYPE "BookingSource" ADD VALUE 'GOOGLE_SITE';
ALTER TYPE "BookingSource" ADD VALUE 'REGULAR';
ALTER TYPE "BookingSource" ADD VALUE 'RETURNING';
ALTER TYPE "BookingSource" ADD VALUE 'REFERRAL';
ALTER TYPE "BookingSource" ADD VALUE 'AGENT';
ALTER TYPE "BookingSource" ADD VALUE 'OUTDOOR_AD';
ALTER TYPE "BookingSource" ADD VALUE 'BLOGGERS';
ALTER TYPE "BookingSource" ADD VALUE 'B2B';
ALTER TYPE "BookingSource" ADD VALUE 'BI_KMG_QAZGAZ';

-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'ARRIVED';
