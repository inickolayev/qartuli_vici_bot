import { TranslationResponse } from '../../llm/types/llm.types'

export interface ExistingWord {
  georgian: string
  russianPrimary: string
}

export interface ParsedWord {
  georgian: string
  russian?: string // Translation from the original message (if provided)
}

export interface BulkImportSession {
  userId: string
  telegramId: string
  words: string[]
  parsedWords?: ParsedWord[] // Words with their translations from messages
  existingWords?: ExistingWord[]
  newWords?: string[]
  wordsToTranslate?: string[] // Words without translations that need GPT
  translations?: TranslationResponse[]
  collectionId?: string
  state: BulkImportState
  createdAt: Date
  lastMessageAt?: Date
}

export enum BulkImportState {
  COLLECTING = 'collecting', // User is forwarding messages
  DETECTED = 'detected',
  TRANSLATING = 'translating',
  PREVIEW = 'preview',
  EDITING = 'editing',
  SAVING = 'saving',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}
