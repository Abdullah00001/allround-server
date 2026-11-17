-- Note: ProjectNoteCategory values OPEN_POINTS / AGREEMENTS /
-- SPECIAL_REQUIREMENTS / LOCAL_CONTACT are created in
-- 20261115090000_mobile_sm_project_mgmt (enum CREATE must run first;
-- this file previously ALTERed the type before it existed and broke shadow DB).

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "fileSize" INTEGER;

-- AlterTable
ALTER TABLE "Inspection" ADD COLUMN     "projectId" TEXT;

-- CreateIndex
CREATE INDEX "Inspection_projectId_idx" ON "Inspection"("projectId");

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
