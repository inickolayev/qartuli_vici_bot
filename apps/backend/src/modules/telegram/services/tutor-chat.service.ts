import { Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { RedisService } from '../../../common/redis/redis.service'
import { LLMService } from '../../llm/llm.service'
import { ChatMessage } from '../../llm/types/llm.types'
import {
  TutorChatSession,
  TutorChatMessage,
  TUTOR_CHAT_KEY_PREFIX,
  TUTOR_CHAT_TTL,
  MAX_HISTORY_MESSAGES,
  MAX_MESSAGES_PER_SESSION,
} from '../types/tutor-chat.types'

const SYSTEM_PROMPT = `Ты — опытный грузинско-русский учитель с 10-летним стажем.
Ты прекрасно разбираешься в переводах, контексте, нюансах грузинского языка.

Правила:
- Уровень ученика: A2-B1. Объясняй просто и понятно.
- Если ученик присылает слово на грузинском — дай перевод на русский и придумай простое предложение на грузинском с этим словом (с переводом).
- Если ученик присылает слово на русском — дай перевод на грузинский и пример предложения.
- Если ученик задаёт вопрос о грамматике, правилах или контексте — отвечай кратко и с примерами.
- Используй транслитерацию (латиницей или кириллицей) для сложных слов, чтобы ученик мог прочитать.
- Будь дружелюбным и поддерживающим. Хвали за правильные попытки.
- Отвечай на русском языке, грузинские слова пиши грузинским алфавитом.
- Не используй HTML-разметку. Пиши простым текстом.`

export interface TutorChatResponse {
  reply: string
  isRateLimited?: boolean
  isBudgetExceeded?: boolean
}

@Injectable()
export class TutorChatService {
  constructor(
    private readonly redis: RedisService,
    private readonly llmService: LLMService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(TutorChatService.name)
  }

  async startSession(userId: string, telegramId: string): Promise<void> {
    const session: TutorChatSession = {
      telegramId,
      userId,
      messages: [],
      messageCount: 0,
      createdAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString(),
    }

    await this.redis.setJson(this.getKey(telegramId), session, TUTOR_CHAT_TTL)
    this.logger.info({ telegramId }, 'Tutor chat session started')
  }

  async isInChatMode(telegramId: string): Promise<boolean> {
    return this.redis.exists(this.getKey(telegramId))
  }

  async endSession(telegramId: string): Promise<void> {
    await this.redis.del(this.getKey(telegramId))
    this.logger.info({ telegramId }, 'Tutor chat session ended')
  }

  async sendMessage(telegramId: string, userMessage: string): Promise<TutorChatResponse> {
    const session = await this.redis.getJson<TutorChatSession>(this.getKey(telegramId))

    if (!session) {
      return { reply: 'Сессия истекла. Начни новый чат командой /chat' }
    }

    // Rate limit check
    if (session.messageCount >= MAX_MESSAGES_PER_SESSION) {
      return {
        reply: 'Достигнут лимит сообщений в этой сессии. Заверши чат и начни новый.',
        isRateLimited: true,
      }
    }

    // Budget check
    const budget = await this.llmService.checkBudget()
    if (budget.isExceeded) {
      return {
        reply: 'Дневной лимит AI исчерпан. Попробуй завтра.',
        isBudgetExceeded: true,
      }
    }

    // Build messages array for GPT
    const chatMessages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...this.trimHistory(session.messages),
      { role: 'user', content: userMessage },
    ]

    try {
      const response = await this.llmService.chatCompletion(chatMessages, session.userId)

      // Update session with new messages
      const updatedMessages: TutorChatMessage[] = [
        ...session.messages,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: response.content },
      ]

      const updatedSession: TutorChatSession = {
        ...session,
        messages: updatedMessages,
        messageCount: session.messageCount + 1,
        lastMessageAt: new Date().toISOString(),
      }

      await this.redis.setJson(this.getKey(telegramId), updatedSession, TUTOR_CHAT_TTL)

      return { reply: response.content }
    } catch (error) {
      this.logger.error({ error, telegramId }, 'Tutor chat LLM call failed')
      return { reply: 'Учитель временно недоступен. Попробуй ещё раз.' }
    }
  }

  private trimHistory(messages: TutorChatMessage[]): ChatMessage[] {
    const trimmed = messages.slice(-MAX_HISTORY_MESSAGES)
    return trimmed.map((m) => ({ role: m.role, content: m.content }))
  }

  private getKey(telegramId: string): string {
    return `${TUTOR_CHAT_KEY_PREFIX}${telegramId}`
  }
}
