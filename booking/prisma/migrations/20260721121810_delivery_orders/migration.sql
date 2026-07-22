-- CreateTable
CREATE TABLE "DeliveryOrder" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMPTZ(6) NOT NULL,
    "amount" INTEGER NOT NULL,
    "courierCost" INTEGER,
    "address" TEXT,
    "phone" TEXT,
    "promo" TEXT,
    "note" TEXT,
    "manager" TEXT,

    CONSTRAINT "DeliveryOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryOrder_date_idx" ON "DeliveryOrder"("date");
