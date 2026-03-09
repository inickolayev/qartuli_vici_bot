export interface TranslationResponse {
  georgian: string
  russianPrimary: string
  russianAlt: string[]
  transcription?: string
  partOfSpeech?: string
}

export interface BatchTranslationResponse {
  translations: TranslationResponse[]
  totalTokens: number
  costUsd: number
}

export interface LLMConfig {
  apiKey: string
  model: string
  maxRetries: number
  dailyBudgetUsd: number
}

export interface UsageStats {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}
