export interface TutorChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface TutorChatSession {
  telegramId: string
  userId: string
  messages: TutorChatMessage[]
  messageCount: number
  createdAt: string
  lastMessageAt: string
}

export const TUTOR_CHAT_KEY_PREFIX = 'tutor_chat:'
export const TUTOR_CHAT_TTL = 3600 // 1 hour from last message
export const MAX_HISTORY_MESSAGES = 20 // last 20 messages kept in context
export const MAX_MESSAGES_PER_SESSION = 50 // rate limit per session
