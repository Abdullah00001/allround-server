-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN "isCover" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Attachment_projectId_isCover_idx" ON "Attachment"("projectId", "isCover");
