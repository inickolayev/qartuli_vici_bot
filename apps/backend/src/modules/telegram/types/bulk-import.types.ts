import { TranslationResponse } from '../../llm/types/llm.types'

export interface BulkImportSession {
  userId: string
  telegramId: string
  words: string[]
  translations?: TranslationResponse[]
  collectionId?: string
  state: BulkImportState
  createdAt: Date
}

export enum BulkImportState {
  DETECTED = 'detected',
  TRANSLATING = 'translating',
  PREVIEW = 'preview',
  EDITING = 'editing',
  SAVING = 'saving',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}
