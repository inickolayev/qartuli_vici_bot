# План разработки: Telegram-бот для изучения грузинского языка

## Содержание

1. [Архитектура](#1-архитектура)
2. [Переменные окружения](#2-переменные-окружения)
3. [Сущности БД](#3-сущности-бд-prisma-schema)
4. [Основные алгоритмы](#4-основные-алгоритмы)
5. [API контракты](#5-api-контракты)
6. [Тестирование](#6-тестирование)
7. [План реализации по этапам](#7-план-реализации-по-этапам)
8. [Деплой и инфраструктура](#8-деплой-и-инфраструктура)
9. [Риски и оптимизации](#9-риски-и-оптимизации)

---

## 1. Архитектура

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INFRASTRUCTURE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐     ┌──────────────────────────────────────────────────┐  │
│  │  Telegram   │     │                   BACKEND                         │  │
│  │   Users     │────▶│  ┌────────────────────────────────────────────┐  │  │
│  └─────────────┘     │  │              Nest.js API                    │  │  │
│                      │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │  │  │
│  ┌─────────────┐     │  │  │ Telegram │  │   Quiz   │  │  Admin   │  │  │  │
│  │   Admin     │────▶│  │  │  Module  │  │  Module  │  │  Module  │  │  │  │
│  │   Panel     │     │  │  └──────────┘  └──────────┘  └──────────┘  │  │  │
│  │   (React)   │     │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │  │  │
│  └─────────────┘     │  │  │  Words   │  │  Gamifi- │  │   LLM    │  │  │  │
│                      │  │  │  Module  │  │  cation  │  │  Module  │  │  │  │
│                      │  │  └──────────┘  └──────────┘  └──────────┘  │  │  │
│                      │  └────────────────────────────────────────────┘  │  │
│                      │                        │                          │  │
│                      │           ┌────────────┴────────────┐            │  │
│                      │           ▼                         ▼            │  │
│                      │  ┌─────────────────┐    ┌─────────────────┐     │  │
│                      │  │   PostgreSQL    │    │     Redis       │     │  │
│                      │  │   (Prisma ORM)  │    │   (Cache/Queue) │     │  │
│                      │  └─────────────────┘    └─────────────────┘     │  │
│                      └──────────────────────────────────────────────────┘  │
│                                        │                                    │
│                                        ▼                                    │
│                              ┌──────────────────┐                          │
│                              │   OpenAI API     │                          │
│                              │   (ChatGPT)      │                          │
│                              └──────────────────┘                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Модульная структура Nest.js

```
src/
├── modules/
│   ├── telegram/          # Telegram Bot (telegraf)
│   │   ├── handlers/      # Command & callback handlers
│   │   ├── keyboards/     # Inline keyboards
│   │   └── scenes/        # Conversation flows
│   │
│   ├── quiz/              # Quiz logic
│   │   ├── generators/    # Exercise generators by type
│   │   ├── validators/    # Answer validation chain
│   │   └── scheduler/     # Periodic quiz scheduling
│   │
│   ├── words/             # Words & Collections CRUD
│   │   ├── services/
│   │   └── enrichment/    # LLM word enrichment
│   │
│   ├── gamification/      # XP, Streaks, Levels, Achievements
│   │   ├── achievements/
│   │   └── progress/
│   │
│   ├── llm/               # LLM integration (OpenAI)
│   │   ├── providers/
│   │   └── cache/
│   │
│   ├── auth/              # Telegram OAuth for admin
│   │
│   └── admin/             # Admin API endpoints
│
├── common/
│   ├── decorators/
│   ├── guards/
│   ├── interceptors/
│   └── pipes/
│
└── prisma/
    ├── schema.prisma
    └── migrations/
```

---

## 2. Переменные окружения

```bash
# .env.example

# ==================== APP ====================
NODE_ENV=development          # development | production
PORT=3000                     # Backend API port
ADMIN_PORT=3001               # Admin panel port (if separate)

# ==================== DATABASE ====================
DATABASE_URL=postgresql://user:password@localhost:5432/qartuli_bot
DATABASE_POOL_SIZE=10         # Connection pool size

# ==================== REDIS ====================
REDIS_URL=redis://localhost:6379
REDIS_PREFIX=qartuli:         # Key prefix for namespacing

# ==================== TELEGRAM ====================
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_WEBHOOK_URL=https://your-domain.com/api/telegram/webhook
TELEGRAM_WEBHOOK_SECRET=random-secret-string

# ==================== OPENAI ====================
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini      # Default model for verification
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_DAILY_BUDGET_USD=10    # Daily spending limit
OPENAI_MAX_RETRIES=3

# ==================== AUTH ====================
JWT_SECRET=your-jwt-secret-min-32-chars
JWT_EXPIRES_IN=7d             # Token expiration

# ==================== FEATURES ====================
QUIZ_DEFAULT_FREQUENCY=3      # Default quizzes per day
QUIZ_WORDS_PER_SESSION=10     # Words per quiz session
QUIZ_COOLDOWN_HOURS=2         # Min hours between quizzes

# ==================== MONITORING ====================
SENTRY_DSN=https://...@sentry.io/...
LOG_LEVEL=info                # debug | info | warn | error

# ==================== ADMIN ====================
ADMIN_TELEGRAM_IDS=123456789,987654321  # Comma-separated admin IDs
```

---

## 3. Сущности БД (Prisma Schema)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ==================== USERS ====================

model User {
  id              String    @id @default(cuid())
  telegramId      BigInt    @unique
  username        String?
  firstName       String?
  lastName        String?
  languageCode    String?   @default("ru")
  timezone        String?   @default("Europe/Moscow")

  // Gamification
  xp              Int       @default(0)
  level           Int       @default(1)
  currentStreak   Int       @default(0)
  longestStreak   Int       @default(0)
  lastActivityAt  DateTime?

  // Settings
  quizFrequency   Int       @default(3)  // quizzes per day
  quietHoursStart Int?      // 0-23
  quietHoursEnd   Int?      // 0-23
  isAdmin         Boolean   @default(false)

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Relations
  wordProgress       UserWordProgress[]
  quizSessions       QuizSession[]
  achievements       UserAchievement[]
  collections        UserCollection[]
  createdWords       Word[]             @relation("WordCreator")
  createdCollections Collection[]       @relation("CollectionCreator")
  dailyStats         DailyStats[]

  @@index([telegramId])
  @@index([lastActivityAt])
}

// ==================== WORDS ====================

model Word {
  id              String    @id @default(cuid())

  // Core data
  georgian        String    // ლამაზი
  russianPrimary  String    // красивый (основной перевод)

  // Enriched data (from LLM)
  russianAlt      String[]  // ["красивая", "красивое", "прекрасный"]
  georgianForms   String[]  // [declined/conjugated forms]
  transcription   String?   // lamazi
  partOfSpeech    PartOfSpeech?
  exampleKa       String?   // Georgian example sentence
  exampleRu       String?   // Russian translation of example
  audioUrl        String?   // Optional TTS URL
  notes           String?   // Usage notes

  // Metadata
  difficulty      Difficulty @default(MEDIUM)
  frequency       Int?       // Word frequency rank
  tags            String[]

  // Creator & source
  creatorId       String?
  creator         User?     @relation("WordCreator", fields: [creatorId], references: [id])
  isPublic        Boolean   @default(false)

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Relations
  collections     CollectionWord[]
  userProgress    UserWordProgress[]
  quizAnswers     QuizAnswer[]

  @@unique([georgian, russianPrimary])
  @@index([georgian])
  @@index([russianPrimary])
  @@index([difficulty])
}

enum PartOfSpeech {
  NOUN
  VERB
  ADJECTIVE
  ADVERB
  PRONOUN
  PREPOSITION
  CONJUNCTION
  INTERJECTION
  NUMERAL
  PARTICLE
}

enum Difficulty {
  EASY
  MEDIUM
  HARD
}

// ==================== COLLECTIONS ====================

model Collection {
  id              String    @id @default(cuid())
  name            String
  description     String?

  // Access control
  type            CollectionType @default(PRIVATE)
  shareCode       String?   @unique  // for SHARED collections
  creatorId       String?
  creator         User?     @relation("CollectionCreator", fields: [creatorId], references: [id])

  // Stats (denormalized, updated via triggers/service)
  wordCount       Int       @default(0)

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Relations
  words           CollectionWord[]
  users           UserCollection[]

  @@index([shareCode])
  @@index([type])
  @@index([creatorId])
}

enum CollectionType {
  DEFAULT    // System default collections
  PRIVATE    // User's private collection
  SHARED     // Shareable by link
}

model CollectionWord {
  id              String    @id @default(cuid())
  collectionId    String
  wordId          String
  orderIndex      Int       @default(0)

  collection      Collection @relation(fields: [collectionId], references: [id], onDelete: Cascade)
  word            Word       @relation(fields: [wordId], references: [id], onDelete: Cascade)

  addedAt         DateTime  @default(now())

  @@unique([collectionId, wordId])
  @@index([collectionId])
}

model UserCollection {
  id              String    @id @default(cuid())
  userId          String
  collectionId    String
  isActive        Boolean   @default(true)  // Include in quizzes

  user            User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  collection      Collection @relation(fields: [collectionId], references: [id], onDelete: Cascade)

  addedAt         DateTime  @default(now())

  @@unique([userId, collectionId])
  @@index([userId, isActive])
}

// ==================== USER PROGRESS ====================

model UserWordProgress {
  id              String    @id @default(cuid())
  userId          String
  wordId          String

  // Knowledge rating
  rating          Int       @default(0)   // -∞ to +∞, learned at ≥4

  // Stats
  correctCount    Int       @default(0)
  incorrectCount  Int       @default(0)
  totalAttempts   Int       @default(0)

  // Timing
  lastSeenAt      DateTime?
  lastCorrectAt   DateTime?
  lastIncorrectAt DateTime?
  nextReviewAt    DateTime?  // For spaced repetition

  // Learning status
  status          LearningStatus @default(NEW)

  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  word            Word      @relation(fields: [wordId], references: [id], onDelete: Cascade)

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@unique([userId, wordId])
  @@index([userId, status])
  @@index([userId, rating])
  @@index([userId, nextReviewAt])
}

enum LearningStatus {
  NEW         // Never seen
  LEARNING    // In progress (rating 0-3)
  LEARNED     // Rating ≥ 4
  MASTERED    // Rating ≥ 7 with no recent errors
}

// ==================== QUIZ ====================

model QuizSession {
  id              String    @id @default(cuid())
  userId          String

  // Session info
  type            QuizSessionType @default(SCHEDULED)
  status          QuizSessionStatus @default(IN_PROGRESS)

  // Stats
  totalQuestions  Int       @default(0)
  correctAnswers  Int       @default(0)
  xpEarned        Int       @default(0)

  startedAt       DateTime  @default(now())
  completedAt     DateTime?

  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  answers         QuizAnswer[]

  @@index([userId, status])
  @@index([userId, startedAt])
}

enum QuizSessionType {
  SCHEDULED   // Automatic periodic quiz
  MANUAL      // User-initiated practice
  REVIEW      // Review of mistakes
}

enum QuizSessionStatus {
  IN_PROGRESS
  COMPLETED
  ABANDONED
}

model QuizAnswer {
  id              String    @id @default(cuid())
  sessionId       String
  wordId          String

  // Question
  exerciseType    ExerciseType
  question        String    // The actual question text
  correctAnswer   String    // Expected answer
  options         String[]  // For multiple choice

  // User response
  userAnswer      String?
  isCorrect       Boolean?

  // Timing
  askedAt         DateTime  @default(now())
  answeredAt      DateTime?
  responseTimeMs  Int?

  // Verification
  verificationMethod VerificationMethod?
  llmVerificationId  String?  // Link to LLM verification cache

  session         QuizSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  word            Word        @relation(fields: [wordId], references: [id])

  @@index([sessionId])
  @@index([wordId])
  @@index([askedAt])
  @@index([isCorrect])  // For analytics queries
}

enum ExerciseType {
  KA_TO_RU        // Georgian → Russian translation
  RU_TO_KA        // Russian → Georgian translation
  MULTIPLE_CHOICE // 4 options
  USE_IN_PHRASE   // Use word in Georgian phrase
}

enum VerificationMethod {
  EXACT_MATCH
  NORMALIZED_MATCH
  ALLOWED_FORMS
  SEMANTIC_SIMILARITY
  LLM_VERIFICATION
}

// ==================== LLM CACHE ====================

model LLMVerificationCache {
  id              String    @id @default(cuid())

  // Input hash for lookup
  inputHash       String    @unique

  // Original data
  exerciseType    ExerciseType
  expectedAnswer  String
  userAnswer      String
  wordId          String?

  // LLM response
  isCorrect       Boolean
  explanation     String?
  confidence      Float?

  // Cost tracking
  promptTokens    Int
  completionTokens Int
  model           String
  costUsd         Float

  createdAt       DateTime  @default(now())
  expiresAt       DateTime?

  @@index([inputHash])
  @@index([createdAt])
}

model LLMUsageLog {
  id              String    @id @default(cuid())
  userId          String?

  // Request info
  operation       LLMOperation
  model           String

  // Tokens & cost
  promptTokens    Int
  completionTokens Int
  totalTokens     Int
  costUsd         Float

  // Timing
  latencyMs       Int

  createdAt       DateTime  @default(now())

  @@index([userId])
  @@index([createdAt])
  @@index([operation])
}

enum LLMOperation {
  ANSWER_VERIFICATION
  WORD_ENRICHMENT
  PHRASE_GENERATION
  PHRASE_VALIDATION
}

// ==================== GAMIFICATION ====================

model Achievement {
  id              String    @id @default(cuid())

  // Display
  code            String    @unique  // "FIRST_100_WORDS"
  name            String             // "Первая сотня"
  description     String             // "Выучите 100 слов"
  icon            String?            // Emoji or URL

  // Rule (JSON for flexibility)
  ruleType        AchievementRuleType
  ruleConfig      Json      // { "threshold": 100, "metric": "words_learned" }

  // Reward
  xpReward        Int       @default(0)

  // Visibility
  isHidden        Boolean   @default(false)  // Secret achievements
  isActive        Boolean   @default(true)

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  users           UserAchievement[]

  @@index([isActive])
}

enum AchievementRuleType {
  WORDS_LEARNED       // Learn X words
  STREAK_DAYS         // Maintain X day streak
  TOTAL_XP            // Earn X total XP
  QUIZ_PERFECT        // X perfect quizzes
  COLLECTION_COMPLETE // Complete a collection
  DAILY_GOAL          // Meet daily goal X times
  ACCURACY_RATE       // Maintain X% accuracy over Y attempts
  CUSTOM              // Custom rule in ruleConfig
}

model UserAchievement {
  id              String    @id @default(cuid())
  userId          String
  achievementId   String

  unlockedAt      DateTime  @default(now())
  progress        Int?      // For progress-based achievements

  user            User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  achievement     Achievement @relation(fields: [achievementId], references: [id], onDelete: Cascade)

  @@unique([userId, achievementId])
  @@index([userId])
}

model DailyStats {
  id              String    @id @default(cuid())
  userId          String
  date            DateTime  @db.Date

  // Daily metrics
  quizzesCompleted Int      @default(0)
  wordsReviewed    Int      @default(0)
  correctAnswers   Int      @default(0)
  incorrectAnswers Int      @default(0)
  xpEarned         Int      @default(0)
  newWordsLearned  Int      @default(0)
  timeSpentSec     Int      @default(0)  // Time spent learning

  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, date])
  @@index([userId, date])
}
```

---

## 4. Основные алгоритмы

### 4.0 Общие типы

```typescript
// src/common/types/index.ts

// Validator interfaces
interface AnswerValidator {
  method: VerificationMethod
  shouldRun(ctx: ValidationContext): boolean
  validate(ctx: ValidationContext): Promise<ValidatorResult>
}

interface ValidatorResult {
  isCorrect: boolean
  isDefinitive: boolean // If true, stop validation chain
  confidence: number // 0-1
  explanation?: string
}

// XP types
type XPReason =
  | 'CORRECT_ANSWER'
  | 'PERFECT_QUIZ'
  | 'WORD_LEARNED'
  | 'WORD_MASTERED'
  | 'ACHIEVEMENT_UNLOCKED'
  | 'STREAK_BONUS'

interface XPContext {
  wordId?: string
  quizSessionId?: string
  achievementId?: string
}

interface XPAwardResult {
  xpAwarded: number
  totalXP: number
  level: number
  leveledUp: boolean
}

interface StreakResult {
  currentStreak: number
  longestStreak: number
  changed: boolean
  isNewRecord?: boolean
}
```

### 4.1 Алгоритм выбора слов для квиза

```typescript
// src/modules/quiz/services/word-selector.service.ts

interface WordSelectionCriteria {
  userId: string
  count: number // How many words to select
  collectionIds?: string[] // Filter by collections
}

interface ScoredWord {
  wordId: string
  score: number // Higher = more likely to be selected
}

@Injectable()
export class WordSelectorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async selectWordsForQuiz(criteria: WordSelectionCriteria): Promise<string[]> {
    const { userId, count, collectionIds } = criteria

    // 1. Get user's word pool from active collections
    const wordPool = await this.getWordPool(userId, collectionIds)

    if (wordPool.length === 0) {
      return []
    }

    // 2. Calculate selection score for each word
    const scoredWords = await this.calculateScores(userId, wordPool)

    // 3. Weighted random selection
    return this.weightedRandomSelect(scoredWords, count)
  }

  private async calculateScores(userId: string, wordIds: string[]): Promise<ScoredWord[]> {
    const progress = await this.prisma.userWordProgress.findMany({
      where: { userId, wordId: { in: wordIds } },
    })

    const progressMap = new Map(progress.map((p) => [p.wordId, p]))
    const now = Date.now()

    return wordIds.map((wordId) => {
      const p = progressMap.get(wordId)

      if (!p) {
        // New word - high priority
        return { wordId, score: 100 }
      }

      let score = 50 // Base score

      // Factor 1: Rating (lower rating = higher score)
      // Rating range: typically -5 to +7
      // Map to score adjustment: -30 to +30
      score -= p.rating * 5

      // Factor 2: Recent errors boost
      if (p.lastIncorrectAt) {
        const hoursSinceError = (now - p.lastIncorrectAt.getTime()) / 3600000
        if (hoursSinceError < 24) {
          score += 30 // Recent error = high boost
        } else if (hoursSinceError < 72) {
          score += 15
        }
      }

      // Factor 3: Time since last seen (spaced repetition)
      if (p.lastSeenAt) {
        const hoursSinceSeen = (now - p.lastSeenAt.getTime()) / 3600000

        // Words due for review get boost
        if (p.nextReviewAt && p.nextReviewAt.getTime() <= now) {
          score += 25
        }

        // Not seen in a while = needs review
        if (hoursSinceSeen > 168) {
          // > 1 week
          score += 20
        }
      }

      // Factor 4: Learning status
      if (p.status === 'NEW') {
        score += 40
      } else if (p.status === 'LEARNING') {
        score += 20
      } else if (p.status === 'LEARNED') {
        score -= 10
      } else if (p.status === 'MASTERED') {
        score -= 30
      }

      // Factor 5: Error rate
      if (p.totalAttempts > 0) {
        const errorRate = p.incorrectCount / p.totalAttempts
        if (errorRate > 0.5) {
          score += 25 // Struggling with this word
        }
      }

      return { wordId, score: Math.max(score, 1) }
    })
  }

  private weightedRandomSelect(scoredWords: ScoredWord[], count: number): string[] {
    const selected: string[] = []
    const remaining = [...scoredWords]

    while (selected.length < count && remaining.length > 0) {
      // Calculate total weight
      const totalWeight = remaining.reduce((sum, w) => sum + w.score, 0)

      // Random selection based on weight
      let random = Math.random() * totalWeight

      for (let i = 0; i < remaining.length; i++) {
        random -= remaining[i].score
        if (random <= 0) {
          selected.push(remaining[i].wordId)
          remaining.splice(i, 1)
          break
        }
      }
    }

    return selected
  }
}
```

### 4.2 Алгоритм проверки ответов (Answer Validation Chain)

```typescript
// src/modules/quiz/validators/answer-validator.service.ts

interface ValidationResult {
  isCorrect: boolean
  method: VerificationMethod
  confidence: number // 0-1
  explanation?: string
}

interface ValidationContext {
  exerciseType: ExerciseType
  word: Word
  expectedAnswer: string
  userAnswer: string
  allowedAnswers?: string[]
}

@Injectable()
export class AnswerValidatorService {
  private validators: AnswerValidator[]

  constructor(
    private readonly llmService: LLMService,
    private readonly cacheService: LLMCacheService,
    private readonly semanticService: SemanticSimilarityService,
  ) {
    // Chain of validators (cheap to expensive)
    this.validators = [
      new ExactMatchValidator(),
      new NormalizedMatchValidator(),
      new AllowedFormsValidator(),
      new SemanticSimilarityValidator(this.semanticService),
      new LLMValidator(this.llmService, this.cacheService),
    ]
  }

  async validate(ctx: ValidationContext): Promise<ValidationResult> {
    for (const validator of this.validators) {
      if (!validator.shouldRun(ctx)) {
        continue
      }

      const result = await validator.validate(ctx)

      if (result.isDefinitive) {
        return {
          isCorrect: result.isCorrect,
          method: validator.method,
          confidence: result.confidence,
          explanation: result.explanation,
        }
      }
    }

    // Fallback: treat as incorrect if all validators uncertain
    return {
      isCorrect: false,
      method: 'LLM_VERIFICATION',
      confidence: 0.5,
      explanation: 'Could not definitively verify answer',
    }
  }
}

// Validator 1: Exact Match
class ExactMatchValidator implements AnswerValidator {
  method = 'EXACT_MATCH' as const

  shouldRun(ctx: ValidationContext): boolean {
    return true // Always runs first
  }

  async validate(ctx: ValidationContext): Promise<ValidatorResult> {
    const isCorrect = ctx.userAnswer.trim() === ctx.expectedAnswer.trim()
    return {
      isCorrect,
      isDefinitive: isCorrect, // Only definitive if correct
      confidence: isCorrect ? 1.0 : 0,
    }
  }
}

// Validator 2: Normalized Match
class NormalizedMatchValidator implements AnswerValidator {
  method = 'NORMALIZED_MATCH' as const

  shouldRun(ctx: ValidationContext): boolean {
    return true
  }

  async validate(ctx: ValidationContext): Promise<ValidatorResult> {
    const normalizedUser = this.normalize(ctx.userAnswer)
    const normalizedExpected = this.normalize(ctx.expectedAnswer)

    const isCorrect = normalizedUser === normalizedExpected
    return {
      isCorrect,
      isDefinitive: isCorrect,
      confidence: isCorrect ? 0.95 : 0,
    }
  }

  private normalize(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[.,!?;:'"«»„"]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/ё/g, 'е') // Russian ё → е
  }
}

// Validator 3: Allowed Forms (from word metadata)
class AllowedFormsValidator implements AnswerValidator {
  method = 'ALLOWED_FORMS' as const

  shouldRun(ctx: ValidationContext): boolean {
    // Only for RU_TO_KA (Georgian has forms) or KA_TO_RU (Russian has gender)
    return ['RU_TO_KA', 'KA_TO_RU'].includes(ctx.exerciseType)
  }

  async validate(ctx: ValidationContext): Promise<ValidatorResult> {
    const allowedAnswers =
      ctx.exerciseType === 'KA_TO_RU'
        ? [ctx.word.russianPrimary, ...ctx.word.russianAlt]
        : [ctx.word.georgian, ...ctx.word.georgianForms]

    const normalizedUser = this.normalize(ctx.userAnswer)
    const isCorrect = allowedAnswers.some((a) => this.normalize(a) === normalizedUser)

    return {
      isCorrect,
      isDefinitive: isCorrect,
      confidence: isCorrect ? 0.98 : 0,
    }
  }

  private normalize(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[.,!?;:'"«»„"]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/ё/g, 'е')
  }
}

// Validator 4: Semantic Similarity (embeddings)
class SemanticSimilarityValidator implements AnswerValidator {
  method = 'SEMANTIC_SIMILARITY' as const
  private readonly THRESHOLD = 0.85

  constructor(private service: SemanticSimilarityService) {}

  shouldRun(ctx: ValidationContext): boolean {
    // Only for text translations, not multiple choice
    return ctx.exerciseType !== 'MULTIPLE_CHOICE'
  }

  async validate(ctx: ValidationContext): Promise<ValidatorResult> {
    const similarity = await this.service.compare(ctx.userAnswer, ctx.expectedAnswer)

    if (similarity >= this.THRESHOLD) {
      return {
        isCorrect: true,
        isDefinitive: true,
        confidence: similarity,
      }
    }

    return {
      isCorrect: false,
      isDefinitive: false, // Not definitive - pass to LLM
      confidence: similarity,
    }
  }
}

// Validator 5: LLM (last resort)
class LLMValidator implements AnswerValidator {
  method = 'LLM_VERIFICATION' as const

  constructor(
    private llm: LLMService,
    private cache: LLMCacheService,
  ) {}

  shouldRun(ctx: ValidationContext): boolean {
    return true // Always available as fallback
  }

  async validate(ctx: ValidationContext): Promise<ValidatorResult> {
    // Check cache first
    const cacheKey = this.cache.buildKey(ctx)
    const cached = await this.cache.get(cacheKey)

    if (cached) {
      return {
        isCorrect: cached.isCorrect,
        isDefinitive: true,
        confidence: cached.confidence,
        explanation: cached.explanation,
      }
    }

    // Call LLM
    const result = await this.llm.verifyAnswer({
      exerciseType: ctx.exerciseType,
      word: {
        georgian: ctx.word.georgian,
        russian: ctx.word.russianPrimary,
      },
      expectedAnswer: ctx.expectedAnswer,
      userAnswer: ctx.userAnswer,
    })

    // Cache result
    await this.cache.set(cacheKey, result)

    return {
      isCorrect: result.isCorrect,
      isDefinitive: true,
      confidence: result.confidence,
      explanation: result.explanation,
    }
  }
}
```

### 4.3 Алгоритм расчёта XP и уровней

```typescript
// src/modules/gamification/services/xp.service.ts

interface XPConfig {
  correctAnswer: number // Base XP for correct answer
  streakBonus: number // Bonus per streak day
  perfectQuizBonus: number // Bonus for 100% quiz
  newWordLearned: number // Word reached rating 4
  wordMastered: number // Word reached rating 7
  achievementMultiplier: number
}

const DEFAULT_XP_CONFIG: XPConfig = {
  correctAnswer: 10,
  streakBonus: 5,
  perfectQuizBonus: 50,
  newWordLearned: 25,
  wordMastered: 50,
  achievementMultiplier: 1.5,
}

// Level thresholds (exponential growth)
const LEVEL_THRESHOLDS = [
  0, // Level 1
  100, // Level 2
  300, // Level 3
  600, // Level 4
  1000, // Level 5
  1500, // Level 6
  2200, // Level 7
  3000, // Level 8
  4000, // Level 9
  5200, // Level 10
  // ... continues with formula: previous + (level * 200)
]

@Injectable()
export class XPService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async awardXP(userId: string, reason: XPReason, context?: XPContext): Promise<XPAwardResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    let xpAmount = this.calculateXP(reason, context, user)

    // Apply streak bonus
    if (user.currentStreak > 0) {
      xpAmount += Math.min(user.currentStreak * DEFAULT_XP_CONFIG.streakBonus, 100)
    }

    // Update user
    const oldLevel = user.level
    const newXP = user.xp + xpAmount
    const newLevel = this.calculateLevel(newXP)

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        xp: newXP,
        level: newLevel,
      },
    })

    // Update daily stats
    await this.updateDailyStats(userId, xpAmount)

    // Check for level up
    if (newLevel > oldLevel) {
      this.eventEmitter.emit('user.levelUp', {
        userId,
        oldLevel,
        newLevel,
      })
    }

    return {
      xpAwarded: xpAmount,
      totalXP: newXP,
      level: newLevel,
      leveledUp: newLevel > oldLevel,
    }
  }

  private calculateLevel(totalXP: number): number {
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (totalXP >= LEVEL_THRESHOLDS[i]) {
        return i + 1
      }
    }
    return 1
  }

  async updateStreak(userId: string): Promise<StreakResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const lastActivity = user.lastActivityAt
    let newStreak = user.currentStreak

    if (!lastActivity) {
      // First activity ever
      newStreak = 1
    } else {
      const lastDate = new Date(lastActivity)
      lastDate.setHours(0, 0, 0, 0)

      const daysDiff = Math.floor((today.getTime() - lastDate.getTime()) / 86400000)

      if (daysDiff === 0) {
        // Same day - no change
        return {
          currentStreak: user.currentStreak,
          longestStreak: user.longestStreak,
          changed: false,
        }
      } else if (daysDiff === 1) {
        // Consecutive day - increase streak
        newStreak = user.currentStreak + 1
      } else {
        // Streak broken
        newStreak = 1
      }
    }

    const longestStreak = Math.max(newStreak, user.longestStreak)

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        currentStreak: newStreak,
        longestStreak,
        lastActivityAt: new Date(),
      },
    })

    return {
      currentStreak: newStreak,
      longestStreak,
      changed: true,
      isNewRecord: newStreak > user.longestStreak,
    }
  }
}
```

### 4.4 Алгоритм расписания квизов

```typescript
// src/modules/quiz/services/quiz-scheduler.service.ts

@Injectable()
export class QuizSchedulerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly telegramService: TelegramService,
    private readonly quizService: QuizService,
  ) {}

  @Cron('0 * * * *') // Every hour
  async scheduleQuizzes(): Promise<void> {
    const currentHour = new Date().getUTCHours()

    // Get users who should receive quiz this hour
    const users = await this.prisma.user.findMany({
      where: {
        // Not in quiet hours
        OR: [
          { quietHoursStart: null },
          {
            AND: [{ quietHoursStart: { gt: currentHour } }, { quietHoursEnd: { lt: currentHour } }],
          },
        ],
      },
    })

    for (const user of users) {
      await this.scheduleUserQuiz(user)
    }
  }

  private async scheduleUserQuiz(user: User): Promise<void> {
    // Check if user already had enough quizzes today
    const todayQuizCount = await this.getTodayQuizCount(user.id)

    if (todayQuizCount >= user.quizFrequency) {
      return
    }

    // Check cooldown (at least 2 hours between quizzes)
    const lastQuiz = await this.getLastQuizTime(user.id)
    if (lastQuiz && Date.now() - lastQuiz.getTime() < 2 * 3600000) {
      return
    }

    // Distribute quizzes throughout active hours
    const shouldSendNow = await this.shouldSendQuizNow(user)

    if (shouldSendNow) {
      // Add to Redis queue for processing
      await this.redis.lpush(
        'quiz:queue',
        JSON.stringify({ userId: user.id, telegramId: user.telegramId }),
      )
    }
  }

  @Interval(5000) // Process queue every 5 seconds
  async processQuizQueue(): Promise<void> {
    const item = await this.redis.rpop('quiz:queue')

    if (!item) return

    const { userId, telegramId } = JSON.parse(item)

    try {
      await this.telegramService.sendQuizNotification(telegramId, userId)
    } catch (error) {
      // Log error, maybe retry later
      console.error(`Failed to send quiz to user ${userId}:`, error)
    }
  }
}
```

---

## 5. API Контракты

### 5.1 Telegram Bot Commands

```
/start               - Register & welcome
/quiz                - Start manual quiz
/add <ka> - <ru>     - Add new word
/stats               - View progress
/streak              - View streak info
/achievements        - View achievements
/collections         - Manage collections
/join <code>         - Join shared collection
/settings            - Configure preferences
/help                - Help & commands
```

### 5.2 Admin REST API

```yaml
# Authentication
POST   /api/auth/telegram          # Telegram OAuth callback

# Users
GET    /api/admin/users            # List users (paginated)
GET    /api/admin/users/:id        # User details + progress
GET    /api/admin/users/:id/stats  # Detailed statistics
GET    /api/admin/users/:id/export # Export user data (GDPR)
DELETE /api/admin/users/:id        # Delete user and all data (GDPR)

# Words
GET    /api/admin/words            # List words (search, filter)
POST   /api/admin/words            # Create word
PUT    /api/admin/words/:id        # Update word
DELETE /api/admin/words/:id        # Delete word
POST   /api/admin/words/:id/enrich # Trigger LLM enrichment

# Collections
GET    /api/admin/collections      # List collections
POST   /api/admin/collections      # Create collection
PUT    /api/admin/collections/:id  # Update collection
DELETE /api/admin/collections/:id  # Delete collection
POST   /api/admin/collections/:id/words  # Add words to collection
DELETE /api/admin/collections/:id/words/:wordId  # Remove word from collection

# Quiz
GET    /api/admin/quiz/sessions    # Quiz history
GET    /api/admin/quiz/answers     # Answer history (for analysis)
PUT    /api/admin/quiz/config      # Update quiz parameters

# Achievements
GET    /api/admin/achievements     # List achievements
POST   /api/admin/achievements     # Create achievement
PUT    /api/admin/achievements/:id # Update achievement rules
DELETE /api/admin/achievements/:id # Delete achievement

# Analytics
GET    /api/admin/analytics/overview      # Dashboard stats
GET    /api/admin/analytics/llm-usage     # LLM costs breakdown
GET    /api/admin/analytics/word-stats    # Word difficulty analysis
GET    /api/admin/analytics/user-progress # User progress trends

# System
GET    /api/admin/system/health    # Health check
GET    /api/admin/system/logs      # Recent logs
```

### 5.3 OpenAPI Schemas

```typescript
// DTOs for key endpoints

// POST /api/admin/words
interface CreateWordDto {
  georgian: string
  russianPrimary: string
  russianAlt?: string[]
  georgianForms?: string[]
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD'
  tags?: string[]
  collectionIds?: string[]
  autoEnrich?: boolean // Trigger LLM enrichment
}

// Response for user details
interface UserDetailsResponse {
  id: string
  telegramId: number
  username: string | null
  firstName: string | null

  stats: {
    xp: number
    level: number
    currentStreak: number
    longestStreak: number

    wordsTotal: number
    wordsLearned: number // rating >= 4
    wordsMastered: number // rating >= 7

    quizzesCompleted: number
    totalAnswers: number
    correctAnswers: number
    accuracyRate: number
  }

  recentActivity: {
    date: string
    wordsReviewed: number
    xpEarned: number
  }[]

  achievements: {
    id: string
    name: string
    unlockedAt: string
  }[]

  createdAt: string
  lastActivityAt: string
}

// LLM usage analytics
interface LLMUsageResponse {
  period: {
    start: string
    end: string
  }

  totals: {
    requests: number
    promptTokens: number
    completionTokens: number
    totalCostUsd: number
  }

  byOperation: {
    operation: string
    requests: number
    costUsd: number
  }[]

  daily: {
    date: string
    requests: number
    costUsd: number
  }[]
}
```

---

## 6. Тестирование

### 6.1 Стратегия тестирования

```
Пирамида тестов:
├── Unit Tests (70%)
│   ├── Services (word selector, validators, XP calculation)
│   ├── Utils (normalization, hashing)
│   └── Guards & Pipes
│
├── Integration Tests (20%)
│   ├── API endpoints
│   ├── Database operations (Prisma)
│   └── Redis caching
│
└── E2E Tests (10%)
    ├── Bot conversation flows
    ├── Quiz completion flow
    └── Admin panel critical paths
```

### 6.2 Инструменты

| Тип      | Инструмент         | Назначение          |
| -------- | ------------------ | ------------------- |
| Unit     | Jest               | Основной фреймворк  |
| Mocking  | jest-mock-extended | Моки для Prisma     |
| E2E API  | Supertest          | HTTP тесты          |
| E2E Bot  | telegraf-test      | Telegram bot тесты  |
| Coverage | Istanbul/c8        | Покрытие кода       |
| DB       | Testcontainers     | PostgreSQL в Docker |

### 6.3 Тестовые данные

```typescript
// test/fixtures/words.fixture.ts
export const testWords = [
  { georgian: 'გამარჯობა', russianPrimary: 'привет', russianAlt: ['здравствуй'] },
  { georgian: 'მადლობა', russianPrimary: 'спасибо', russianAlt: ['благодарю'] },
  // ...
]

// test/factories/user.factory.ts
export const createTestUser = (overrides?: Partial<User>): User => ({
  id: 'test-user-id',
  telegramId: BigInt(123456789),
  xp: 0,
  level: 1,
  currentStreak: 0,
  ...overrides,
})
```

### 6.4 Минимальные требования

- **Coverage**: ≥80% для критических модулей (quiz, validators, gamification)
- **CI**: Все тесты проходят перед merge в main
- **Performance**: API response time <200ms (p95)

---

## 7. План реализации по этапам

### Phase 0: Инфраструктура ✅ COMPLETED

```
✅ 0.1 Настроить репозиторий
    ├── monorepo структура (apps/backend, apps/admin)
    ├── ESLint + Prettier
    ├── Husky pre-commit hooks
    └── GitHub Actions CI

✅ 0.2 Docker инфраструктура
    ├── docker-compose.local.yml (hot reload)
    ├── docker-compose.prod.yml
    ├── Dockerfile.backend (multi-stage)
    ├── Dockerfile.admin
    └── .env.example

✅ 0.3 Базовый Nest.js проект
    ├── Prisma setup + initial schema
    ├── Redis connection
    ├── Config module (env vars)
    ├── Logger (Pino)
    └── Health check endpoint
```

### Phase 1: MVP Core ✅ COMPLETED

```
✅ 1.1 Telegram Bot Foundation
    ├── telegraf integration (nestjs-telegraf)
    ├── /start command (user registration)
    ├── Basic command handlers (/help, /quiz, /stats placeholders)
    └── Keyboard builders (inline keyboards)

✅ 1.2 Words & Collections
    ├── Word CRUD (Prisma)
    ├── Collection CRUD
    ├── Default collection with 50 Georgian words
    └── UserCollection linking

✅ 1.3 Basic Quiz
    ├── Quiz session management
    ├── Word selector (priority scoring: NEW > LEARNING > LEARNED > MASTERED)
    ├── KA_TO_RU exercise type
    ├── RU_TO_KA exercise type
    ├── Answer validation chain (exact + normalized match)
    └── UserWordProgress tracking

✅ 1.4 Progress Tracking
    ├── Rating update on answer (+1/-1)
    ├── Spaced repetition intervals
    ├── XP awards (10 XP per correct answer)
    └── Learning status transitions (NEW → LEARNING → LEARNED → MASTERED)
```

**MVP Deliverable**: Working bot that can quiz users on Georgian words with basic progress tracking.

### Phase 2: Quiz Enhancement

```
☐ 2.1 Multiple Choice
    ├── MULTIPLE_CHOICE exercise type
    ├── Distractor generation
    └── Inline keyboard responses

☐ 2.2 Use in Phrase
    ├── USE_IN_PHRASE exercise type
    ├── Phrase templates
    └── Basic phrase validation

☐ 2.3 Advanced Word Selection
    ├── Full scoring algorithm
    ├── Spaced repetition (nextReviewAt)
    └── Learning status transitions

☐ 2.4 Quiz Scheduling
    ├── Cron-based scheduler
    ├── User timezone support
    ├── Quiet hours
    └── Quiz frequency settings
```

### Phase 3: LLM Integration

```
☐ 3.1 LLM Service
    ├── OpenAI client setup
    ├── Rate limiting
    ├── Error handling & retries
    └── Usage logging

☐ 3.2 Word Enrichment
    ├── Auto-fetch russianAlt
    ├── Auto-fetch georgianForms
    ├── Generate examples
    └── Transcription generation

☐ 3.3 Answer Verification Chain
    ├── Semantic similarity (embeddings)
    ├── LLM verification fallback
    ├── Result caching
    └── Cost optimization

☐ 3.4 Phrase Generation
    ├── Generate phrases for USE_IN_PHRASE
    ├── Validate user phrases via LLM
    └── Cache generated phrases
```

### Phase 4: Gamification

```
☐ 4.1 XP & Levels
    ├── XP award service
    ├── Level calculation
    ├── Level-up notifications
    └── /stats update with XP/level

☐ 4.2 Streaks
    ├── Streak calculation
    ├── Streak notifications
    ├── Streak recovery (freeze?)
    └── /streak command

☐ 4.3 Achievements
    ├── Achievement model
    ├── Rule engine (JSON-based)
    ├── Achievement check service
    ├── Unlock notifications
    └── /achievements command
```

### Phase 5: Admin Panel

```
☐ 5.1 Auth
    ├── Telegram OAuth widget
    ├── JWT session handling
    ├── Admin guard (isAdmin check)
    └── Login page

☐ 5.2 Dashboard
    ├── Overview stats
    ├── Active users chart
    ├── LLM costs chart
    └── Recent activity feed

☐ 5.3 User Management
    ├── User list with search/filter
    ├── User detail view
    ├── Progress charts
    └── Answer history

☐ 5.4 Content Management
    ├── Word CRUD UI
    ├── Collection management
    ├── Bulk import (CSV)
    └── Word enrichment trigger

☐ 5.5 Configuration
    ├── Achievement rules editor
    ├── Quiz parameters
    ├── System settings
    └── LLM usage analytics
```

### Phase 6: Polish & Launch

```
☐ 6.1 UX Improvements
    ├── Better error messages
    ├── Help texts & onboarding
    ├── Emoji & formatting
    └── Response time optimization

☐ 6.2 Monitoring
    ├── Error tracking (Sentry)
    ├── Metrics (Prometheus?)
    ├── Alert setup
    └── Log aggregation

☐ 6.3 Documentation
    ├── README
    ├── API documentation
    ├── Deployment guide
    └── Admin user guide

☐ 6.4 Launch Prep
    ├── Production environment
    ├── Backup strategy
    ├── Load testing
    └── Initial content seeding
```

---

## 8. Деплой и инфраструктура

### 8.1 Окружения

| Окружение  | Назначение   | URL                             |
| ---------- | ------------ | ------------------------------- |
| Local      | Разработка   | localhost:3000                  |
| Staging    | Тестирование | staging.qartuli-bot.example.com |
| Production | Продакшн     | qartuli-bot.example.com         |

### 8.2 Docker Compose (Local)

```yaml
# docker-compose.local.yml
version: '3.8'

services:
  backend:
    build:
      context: ./apps/backend
      dockerfile: Dockerfile.dev
    volumes:
      - ./apps/backend/src:/app/src # Hot reload
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/qartuli
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  admin:
    build:
      context: ./apps/admin
      dockerfile: Dockerfile.dev
    volumes:
      - ./apps/admin/src:/app/src
    ports:
      - '3001:3001'
    environment:
      - VITE_API_URL=http://localhost:3000

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=qartuli
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - '5432:5432'

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'

volumes:
  postgres_data:
```

### 8.3 Варианты хостинга

| Вариант              | Плюсы                     | Минусы            | Стоимость |
| -------------------- | ------------------------- | ----------------- | --------- |
| **VPS (Hetzner/DO)** | Полный контроль, дёшево   | Настройка вручную | ~€10/мес  |
| **Railway**          | Простой деплой            | Дороже при росте  | ~$20/мес  |
| **Fly.io**           | Edge locations, autoscale | Сложнее настройка | ~$15/мес  |

### 8.4 CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: |
          npm ci
          npm run test:ci
          npm run lint

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Build Docker images
        run: docker compose -f docker-compose.prod.yml build

      - name: Push to registry
        run: docker compose -f docker-compose.prod.yml push

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          ssh ${{ secrets.DEPLOY_HOST }} "cd /app && docker compose pull && docker compose up -d"
```

### 8.5 Backup Strategy

```bash
# Ежедневный backup PostgreSQL
0 3 * * * pg_dump $DATABASE_URL | gzip > /backups/db-$(date +%Y%m%d).sql.gz

# Хранение: 7 daily, 4 weekly, 3 monthly
# Тестирование restore: еженедельно на staging
```

---

## 9. Риски и оптимизации

### Риски

| Риск                              | Уровень | Митигация                                                           |
| --------------------------------- | ------- | ------------------------------------------------------------------- |
| **LLM costs spiral**              | HIGH    | Aggressive caching, cheap validators first, set daily budget limits |
| **Bot rate limits (Telegram)**    | MEDIUM  | Implement queue with throttling, batch notifications                |
| **Georgian language complexity**  | MEDIUM  | Start with simpler validation, iterate based on user feedback       |
| **User engagement drop**          | MEDIUM  | Strong gamification, personalized difficulty, streak recovery       |
| **Database performance at scale** | LOW     | Proper indexes, consider read replicas later                        |
| **Redis single point of failure** | LOW     | Redis Sentinel for prod, graceful fallback                          |

### Оптимизации

```
Performance:
├── Cache word data in Redis (hot words)
├── Batch achievement checks (not per-answer)
├── Lazy-load user statistics
├── Connection pooling (Prisma)
└── CDN for any static assets

LLM Cost Reduction:
├── Multi-tier validation (cheap → expensive)
├── Cache LLM responses aggressively (30+ days)
├── Use gpt-3.5-turbo for simple checks
├── Batch word enrichment requests
├── Pre-generate common phrases
└── Set hard budget limits with alerts

Scalability:
├── Stateless backend (horizontal scaling)
├── Redis for session state
├── Queue-based quiz scheduling
├── Database connection pooling
└── Consider read replicas at 10k+ users
```

### Метрики для мониторинга

```
Business Metrics:
├── DAU/MAU
├── Quiz completion rate
├── Words learned per user
├── Retention (D1, D7, D30)
└── Session duration

Technical Metrics:
├── LLM cost per user
├── Answer validation latency (p50, p95)
├── Cache hit rate
├── Error rate
└── Database query latency
```

---

## Changelog

| Дата       | Изменение                                                                              |
| ---------- | -------------------------------------------------------------------------------------- |
| 2026-02-05 | Initial plan created                                                                   |
| 2026-02-05 | Added: env variables section, testing strategy, deploy infrastructure                  |
| 2026-02-05 | Fixed: Collection.creatorId, DailyStats.user relation, AllowedFormsValidator.normalize |
| 2026-02-05 | Fixed: Missing type definitions (AnswerValidator, ValidatorResult, XP types)           |
| 2026-02-05 | Added: GDPR endpoints (user export/delete), collection word removal                    |
| 2026-02-05 | Added: QuizAnswer.isCorrect index, DailyStats.timeSpentSec field                       |
| 2026-02-05 | **Phase 0 COMPLETED**: Infrastructure setup                                            |
| 2026-02-05 | **Phase 1 COMPLETED**: MVP Core (Telegram bot, Words, Collections, Quiz, Progress)     |
