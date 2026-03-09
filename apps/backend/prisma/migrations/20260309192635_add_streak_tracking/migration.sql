-- AlterTable
ALTER TABLE "UserWordProgress" ADD COLUMN     "consecutiveCorrect" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "masteredToday" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "UserWordProgress_userId_masteredToday_idx" ON "UserWordProgress"("userId", "masteredToday");
