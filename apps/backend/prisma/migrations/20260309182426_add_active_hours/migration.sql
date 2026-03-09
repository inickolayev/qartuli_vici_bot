/*
  Warnings:

  - You are about to drop the column `quietHoursEnd` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `quietHoursStart` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "quietHoursEnd",
DROP COLUMN "quietHoursStart",
ADD COLUMN     "activeHoursEnd" INTEGER NOT NULL DEFAULT 22,
ADD COLUMN     "activeHoursStart" INTEGER NOT NULL DEFAULT 8;
