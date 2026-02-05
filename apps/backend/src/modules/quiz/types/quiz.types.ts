import { ExerciseType } from '@prisma/client'

export interface Exercise {
  type: ExerciseType
  question: string
  correctAnswer: string
  options: string[]
  wordId: string
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
