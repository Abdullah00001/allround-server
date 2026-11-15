-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProjectNoteCategory" ADD VALUE 'OPEN_POINTS';
ALTER TYPE "ProjectNoteCategory" ADD VALUE 'AGREEMENTS';
ALTER TYPE "ProjectNoteCategory" ADD VALUE 'SPECIAL_REQUIREMENTS';
ALTER TYPE "ProjectNoteCategory" ADD VALUE 'LOCAL_CONTACT';

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "fileSize" INTEGER;

-- AlterTable
ALTER TABLE "Inspection" ADD COLUMN     "projectId" TEXT;

-- CreateIndex
CREATE INDEX "Inspection_projectId_idx" ON "Inspection"("projectId");

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
