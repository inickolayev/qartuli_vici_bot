/**
 * Chat bot types for testing interface
 */

export interface ChatUser {
  id: string // Simulated user ID (will be used as key)
  telegramId: bigint // Simulated Telegram ID
  firstName: string
  lastName?: string
  username?: string
  languageCode?: string
}

export interface ChatButton {
  text: string
  callbackData: string
}

export interface ChatResponse {
  text: string
  parseMode?: 'HTML' | 'plain'
  buttons?: ChatButton[][]
}

export interface ChatSession {
  userId: string // Database user ID
  chatUserId: string // Simulated chat user ID
  telegramId: bigint
  hasActiveQuiz: boolean
  quizSessionId?: string
}

export interface SendMessageDto {
  userId: string
  text: string
}

export interface SendCallbackDto {
  userId: string
  data: string
}

export interface ChatHistoryEntry {
  id: string
  role: 'user' | 'bot'
  text: string
  buttons?: ChatButton[][]
  timestamp: Date
}
