-- AlterTable
ALTER TABLE "QuizAnswer" ADD COLUMN     "orderIndex" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "QuizAnswer_sessionId_orderIndex_idx" ON "QuizAnswer"("sessionId", "orderIndex");
