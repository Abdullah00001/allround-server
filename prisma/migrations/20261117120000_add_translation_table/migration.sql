-- CreateEnum
CREATE TYPE "TranslationStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "Translation" (
    "id" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "sourceLocale" TEXT NOT NULL,
    "targetLocale" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "translatedFields" JSON NOT NULL,
    "status" "TranslationStatus" NOT NULL DEFAULT 'READY',
    "provider" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Translation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Translation_contentType_contentId_targetLocale_status_idx" ON "Translation"("contentType", "contentId", "targetLocale", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Translation_contentType_contentId_targetLocale_sourceHash_key" ON "Translation"("contentType", "contentId", "targetLocale", "sourceHash");
