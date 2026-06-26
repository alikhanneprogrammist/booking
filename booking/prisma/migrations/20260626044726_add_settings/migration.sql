-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "companyName" TEXT NOT NULL DEFAULT 'OFFICE 2020',
    "phone" TEXT,
    "whatsapp" TEXT,
    "instagram" TEXT,
    "email" TEXT,
    "address" TEXT,
    "requisites" TEXT,
    "publicTitleRu" TEXT,
    "publicTitleKk" TEXT,
    "publicSubtitleRu" TEXT,
    "publicSubtitleKk" TEXT,
    "publicInfoRu" TEXT,
    "publicInfoKk" TEXT,
    "publicContacts" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);
