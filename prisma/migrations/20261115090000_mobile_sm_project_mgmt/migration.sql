-- CreateEnum
CREATE TYPE "ProjectNoteCategory" AS ENUM (
  'SITE_ACCESS',
  'CUSTOMER_REQUEST',
  'OPEN_POINTS',
  'AGREEMENTS',
  'SPECIAL_REQUIREMENTS',
  'LOCAL_CONTACT',
  'GENERAL',
  'SAFETY',
  'INTERNAL'
);

-- CreateEnum
CREATE TYPE "AttachmentCategory" AS ENUM ('PHOTO', 'PDF_PLAN', 'OTHER');

-- CreateEnum
CREATE TYPE "MeasurementUnit" AS ENUM ('M', 'M2', 'PCS');

-- AlterTable Inspection
ALTER TABLE "Inspection"
ADD COLUMN "siteAccessInstructions" TEXT,
ADD COLUMN "specialRequirements" TEXT;

-- AlterTable Project
ALTER TABLE "Project"
ADD COLUMN "scaffoldArea" DECIMAL(12,2),
ADD COLUMN "contactName" TEXT,
ADD COLUMN "contactPhone" TEXT,
ADD COLUMN "contactEmail" TEXT;

-- AlterTable ProjectPhase
ALTER TABLE "ProjectPhase"
ADD COLUMN "safetyInspectionComplete" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable ProjectTask
ALTER TABLE "ProjectTask"
ADD COLUMN "description" TEXT,
ADD COLUMN "employeeId" TEXT,
ADD COLUMN "priority" "Priority" NOT NULL DEFAULT 'MEDIUM';

-- AlterTable ProjectNote
ALTER TABLE "ProjectNote"
ADD COLUMN "category" "ProjectNoteCategory" NOT NULL DEFAULT 'GENERAL';

-- AlterTable ProjectMeasurement (expand line-item fields)
ALTER TABLE "ProjectMeasurement"
ADD COLUMN "position" TEXT,
ADD COLUMN "length" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
ADD COLUMN "unit" "MeasurementUnit" NOT NULL DEFAULT 'M',
ADD COLUMN "remark" TEXT;

ALTER TABLE "ProjectMeasurement"
ALTER COLUMN "area" SET DATA TYPE DECIMAL(12,2);

-- AlterTable Attachment
ALTER TABLE "Attachment"
ADD COLUMN "category" "AttachmentCategory" NOT NULL DEFAULT 'OTHER';

-- AddForeignKey
ALTER TABLE "ProjectTask"
ADD CONSTRAINT "ProjectTask_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "ProjectTask_employeeId_idx" ON "ProjectTask"("employeeId");
