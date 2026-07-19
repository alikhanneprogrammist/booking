-- CreateTable
CREATE TABLE "PrepaymentArchive" (
    "id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paymentMethod" "PaymentMethod",
    "guest" TEXT NOT NULL,
    "resourceLabel" TEXT NOT NULL,
    "paidAt" TIMESTAMPTZ(6) NOT NULL,
    "visitAt" TIMESTAMPTZ(6) NOT NULL,
    "note" TEXT,
    "manager" TEXT,

    CONSTRAINT "PrepaymentArchive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrepaymentArchive_paidAt_idx" ON "PrepaymentArchive"("paidAt");
