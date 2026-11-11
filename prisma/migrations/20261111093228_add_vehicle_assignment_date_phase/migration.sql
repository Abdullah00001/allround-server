-- AlterTable
ALTER TABLE "VehicleAssignment" ADD COLUMN "phaseId" TEXT,
ADD COLUMN "date" TIMESTAMP(3);

-- Backfill required columns for any existing rows (dev-safe: delete orphans if no phase exists)
DELETE FROM "VehicleAssignment" WHERE "phaseId" IS NULL OR "date" IS NULL;

-- Make required
ALTER TABLE "VehicleAssignment" ALTER COLUMN "phaseId" SET NOT NULL;
ALTER TABLE "VehicleAssignment" ALTER COLUMN "date" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "VehicleAssignment" ADD CONSTRAINT "VehicleAssignment_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "ProjectPhase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "VehicleAssignment_phaseId_date_idx" ON "VehicleAssignment"("phaseId", "date");

-- CreateIndex
CREATE INDEX "VehicleAssignment_date_idx" ON "VehicleAssignment"("date");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleAssignment_vehicleId_date_key" ON "VehicleAssignment"("vehicleId", "date");
