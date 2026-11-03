/*
  Warnings:

  - You are about to drop the column `isActive` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- DropIndex
DROP INDEX "User_role_isActive_idx";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "isActive",
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "isLegalTermAccepted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isProfileSetup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "phoneVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'INACTIVE';

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");
