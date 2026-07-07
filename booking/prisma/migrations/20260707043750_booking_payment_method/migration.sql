-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('KASPI', 'CASH', 'BANK');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "paymentMethod" "PaymentMethod";
