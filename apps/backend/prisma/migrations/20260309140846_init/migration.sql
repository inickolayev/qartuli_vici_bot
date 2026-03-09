-- CreateEnum
CREATE TYPE "LearningMode" AS ENUM ('ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "PartOfSpeech" AS ENUM ('NOUN', 'VERB', 'ADJECTIVE', 'ADVERB', 'PRONOUN', 'PREPOSITION', 'CONJUNCTION', 'INTERJECTION', 'NUMERAL', 'PARTICLE');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "CollectionType" AS ENUM ('DEFAULT', 'PRIVATE', 'SHARED');

-- CreateEnum
CREATE TYPE "LearningStatus" AS ENUM ('NEW', 'LEARNING', 'LEARNED', 'MASTERED');

-- CreateEnum
CREATE TYPE "QuizSessionType" AS ENUM ('SCHEDULED', 'MANUAL', 'REVIEW');

-- CreateEnum
CREATE TYPE "QuizSessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "ExerciseType" AS ENUM ('KA_TO_RU', 'RU_TO_KA', 'MULTIPLE_CHOICE', 'USE_IN_PHRASE');

-- CreateEnum
CREATE TYPE "VerificationMethod" AS ENUM ('EXACT_MATCH', 'NORMALIZED_MATCH', 'ALLOWED_FORMS', 'SEMANTIC_SIMILARITY', 'LLM_VERIFICATION');

-- CreateEnum
CREATE TYPE "LLMOperation" AS ENUM ('ANSWER_VERIFICATION', 'WORD_ENRICHMENT', 'PHRASE_GENERATION', 'PHRASE_VALIDATION');

-- CreateEnum
CREATE TYPE "AchievementRuleType" AS ENUM ('WORDS_LEARNED', 'STREAK_DAYS', 'TOTAL_XP', 'QUIZ_PERFECT', 'COLLECTION_COMPLETE', 'DAILY_GOAL', 'ACCURACY_RATE', 'CUSTOM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "languageCode" TEXT DEFAULT 'ru',
    "timezone" TEXT DEFAULT 'Europe/Moscow',
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3),
    "quizFrequency" INTEGER NOT NULL DEFAULT 3,
    "quietHoursStart" INTEGER,
    "quietHoursEnd" INTEGER,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "newWordsPerDay" INTEGER NOT NULL DEFAULT 10,
    "learningMode" "LearningMode" NOT NULL DEFAULT 'ACTIVE',
    "preferredHours" INTEGER[] DEFAULT ARRAY[9, 13, 19]::INTEGER[],
    "lastLearningPushAt" TIMESTAMP(3),
    "todayNewWordsCount" INTEGER NOT NULL DEFAULT 0,
    "todayResetAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Word" (
    "id" TEXT NOT NULL,
    "georgian" TEXT NOT NULL,
    "russianPrimary" TEXT NOT NULL,
    "russianAlt" TEXT[],
    "georgianForms" TEXT[],
    "transcription" TEXT,
    "partOfSpeech" "PartOfSpeech",
    "exampleKa" TEXT,
    "exampleRu" TEXT,
    "audioUrl" TEXT,
    "notes" TEXT,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
    "frequency" INTEGER,
    "tags" TEXT[],
    "creatorId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Word_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "CollectionType" NOT NULL DEFAULT 'PRIVATE',
    "shareCode" TEXT,
    "creatorId" TEXT,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionWord" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionWord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCollection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserWordProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "incorrectCount" INTEGER NOT NULL DEFAULT 0,
    "totalAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" TIMESTAMP(3),
    "lastCorrectAt" TIMESTAMP(3),
    "lastIncorrectAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "status" "LearningStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserWordProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "QuizSessionType" NOT NULL DEFAULT 'SCHEDULED',
    "status" "QuizSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "totalQuestions" INTEGER NOT NULL DEFAULT 0,
    "correctAnswers" INTEGER NOT NULL DEFAULT 0,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "QuizSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAnswer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "exerciseType" "ExerciseType" NOT NULL,
    "question" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "options" TEXT[],
    "userAnswer" TEXT,
    "isCorrect" BOOLEAN,
    "askedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "responseTimeMs" INTEGER,
    "verificationMethod" "VerificationMethod",
    "llmVerificationId" TEXT,

    CONSTRAINT "QuizAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LLMVerificationCache" (
    "id" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "exerciseType" "ExerciseType" NOT NULL,
    "expectedAnswer" TEXT NOT NULL,
    "userAnswer" TEXT NOT NULL,
    "wordId" TEXT,
    "isCorrect" BOOLEAN NOT NULL,
    "explanation" TEXT,
    "confidence" DOUBLE PRECISION,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "costUsd" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "LLMVerificationCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LLMUsageLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "operation" "LLMOperation" NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "costUsd" DOUBLE PRECISION NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LLMUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT,
    "ruleType" "AchievementRuleType" NOT NULL,
    "ruleConfig" JSONB NOT NULL,
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "progress" INTEGER,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "quizzesCompleted" INTEGER NOT NULL DEFAULT 0,
    "wordsReviewed" INTEGER NOT NULL DEFAULT 0,
    "correctAnswers" INTEGER NOT NULL DEFAULT 0,
    "incorrectAnswers" INTEGER NOT NULL DEFAULT 0,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "newWordsLearned" INTEGER NOT NULL DEFAULT 0,
    "timeSpentSec" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE INDEX "User_telegramId_idx" ON "User"("telegramId");

-- CreateIndex
CREATE INDEX "User_lastActivityAt_idx" ON "User"("lastActivityAt");

-- CreateIndex
CREATE INDEX "User_learningMode_newWordsPerDay_idx" ON "User"("learningMode", "newWordsPerDay");

-- CreateIndex
CREATE INDEX "Word_georgian_idx" ON "Word"("georgian");

-- CreateIndex
CREATE INDEX "Word_russianPrimary_idx" ON "Word"("russianPrimary");

-- CreateIndex
CREATE INDEX "Word_difficulty_idx" ON "Word"("difficulty");

-- CreateIndex
CREATE UNIQUE INDEX "Word_georgian_russianPrimary_key" ON "Word"("georgian", "russianPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_shareCode_key" ON "Collection"("shareCode");

-- CreateIndex
CREATE INDEX "Collection_shareCode_idx" ON "Collection"("shareCode");

-- CreateIndex
CREATE INDEX "Collection_type_idx" ON "Collection"("type");

-- CreateIndex
CREATE INDEX "Collection_creatorId_idx" ON "Collection"("creatorId");

-- CreateIndex
CREATE INDEX "CollectionWord_collectionId_idx" ON "CollectionWord"("collectionId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionWord_collectionId_wordId_key" ON "CollectionWord"("collectionId", "wordId");

-- CreateIndex
CREATE INDEX "UserCollection_userId_isActive_idx" ON "UserCollection"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "UserCollection_userId_collectionId_key" ON "UserCollection"("userId", "collectionId");

-- CreateIndex
CREATE INDEX "UserWordProgress_userId_status_idx" ON "UserWordProgress"("userId", "status");

-- CreateIndex
CREATE INDEX "UserWordProgress_userId_rating_idx" ON "UserWordProgress"("userId", "rating");

-- CreateIndex
CREATE INDEX "UserWordProgress_userId_nextReviewAt_idx" ON "UserWordProgress"("userId", "nextReviewAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserWordProgress_userId_wordId_key" ON "UserWordProgress"("userId", "wordId");

-- CreateIndex
CREATE INDEX "QuizSession_userId_status_idx" ON "QuizSession"("userId", "status");

-- CreateIndex
CREATE INDEX "QuizSession_userId_startedAt_idx" ON "QuizSession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "QuizAnswer_sessionId_idx" ON "QuizAnswer"("sessionId");

-- CreateIndex
CREATE INDEX "QuizAnswer_wordId_idx" ON "QuizAnswer"("wordId");

-- CreateIndex
CREATE INDEX "QuizAnswer_askedAt_idx" ON "QuizAnswer"("askedAt");

-- CreateIndex
CREATE INDEX "QuizAnswer_isCorrect_idx" ON "QuizAnswer"("isCorrect");

-- CreateIndex
CREATE UNIQUE INDEX "LLMVerificationCache_inputHash_key" ON "LLMVerificationCache"("inputHash");

-- CreateIndex
CREATE INDEX "LLMVerificationCache_inputHash_idx" ON "LLMVerificationCache"("inputHash");

-- CreateIndex
CREATE INDEX "LLMVerificationCache_createdAt_idx" ON "LLMVerificationCache"("createdAt");

-- CreateIndex
CREATE INDEX "LLMUsageLog_userId_idx" ON "LLMUsageLog"("userId");

-- CreateIndex
CREATE INDEX "LLMUsageLog_createdAt_idx" ON "LLMUsageLog"("createdAt");

-- CreateIndex
CREATE INDEX "LLMUsageLog_operation_idx" ON "LLMUsageLog"("operation");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_code_key" ON "Achievement"("code");

-- CreateIndex
CREATE INDEX "Achievement_isActive_idx" ON "Achievement"("isActive");

-- CreateIndex
CREATE INDEX "UserAchievement_userId_idx" ON "UserAchievement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key" ON "UserAchievement"("userId", "achievementId");

-- CreateIndex
CREATE INDEX "DailyStats_userId_date_idx" ON "DailyStats"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyStats_userId_date_key" ON "DailyStats"("userId", "date");

-- AddForeignKey
ALTER TABLE "Word" ADD CONSTRAINT "Word_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionWord" ADD CONSTRAINT "CollectionWord_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionWord" ADD CONSTRAINT "CollectionWord_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCollection" ADD CONSTRAINT "UserCollection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCollection" ADD CONSTRAINT "UserCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWordProgress" ADD CONSTRAINT "UserWordProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWordProgress" ADD CONSTRAINT "UserWordProgress_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizSession" ADD CONSTRAINT "QuizSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "QuizSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyStats" ADD CONSTRAINT "DailyStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
