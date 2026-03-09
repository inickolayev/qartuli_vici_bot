import { ExerciseType, LearningStatus } from '@prisma/client'

export interface Exercise {
  type: ExerciseType
  question: string
  correctAnswer: string
  options: string[]
  wordId: string
}

export interface ExerciseGenerationContext {
  allWords: WordWithProgress[]
  recentTypes: ExerciseType[]
  preferredType?: ExerciseType
}

export interface DistractorConfig {
  count: number
  direction: 'russian' | 'georgian'
}

export interface ExerciseTypeWeights {
  [ExerciseType.MULTIPLE_CHOICE]: number
  [ExerciseType.KA_TO_RU]: number
  [ExerciseType.RU_TO_KA]: number
  [ExerciseType.USE_IN_PHRASE]?: number
}

export const EXERCISE_WEIGHTS_BY_STATUS: Record<string, ExerciseTypeWeights> = {
  [LearningStatus.NEW]: {
    [ExerciseType.MULTIPLE_CHOICE]: 80,
    [ExerciseType.KA_TO_RU]: 20,
    [ExerciseType.RU_TO_KA]: 0,
  },
  [LearningStatus.LEARNING]: {
    [ExerciseType.MULTIPLE_CHOICE]: 30,
    [ExerciseType.KA_TO_RU]: 40,
    [ExerciseType.RU_TO_KA]: 30,
  },
  [LearningStatus.LEARNED]: {
    [ExerciseType.MULTIPLE_CHOICE]: 10,
    [ExerciseType.KA_TO_RU]: 40,
    [ExerciseType.RU_TO_KA]: 50,
  },
  [LearningStatus.MASTERED]: {
    [ExerciseType.MULTIPLE_CHOICE]: 0,
    [ExerciseType.KA_TO_RU]: 30,
    [ExerciseType.RU_TO_KA]: 70,
  },
}

export interface WordWithProgress {
  id: string
  georgian: string
  russianPrimary: string
  russianAlt: string[]
  georgianForms: string[]
  difficulty: string
  progress?: {
    id: string
    rating: number
    status: string
    correctCount: number
    incorrectCount: number
    totalAttempts: number
    consecutiveCorrect: number
    masteredToday: boolean
    lastSeenAt: Date | null
    lastCorrectAt: Date | null
    lastIncorrectAt: Date | null
    nextReviewAt: Date | null
  }
}

export interface QuizState {
  sessionId: string
  userId: string
  currentQuestionIndex: number
  exercises: Exercise[]
  startedAt: Date
}

export interface ValidatorResult {
  isCorrect: boolean
  isDefinitive: boolean
  confidence: number
}

export interface ValidationContext {
  userAnswer: string
  expectedAnswer: string
  exerciseType: ExerciseType
  word: {
    georgian: string
    russianPrimary: string
    russianAlt: string[]
    georgianForms: string[]
  }
}
