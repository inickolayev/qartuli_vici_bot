import { Controller, Post, Get, Body, Query, HttpCode, HttpStatus } from '@nestjs/common'
import { ChatBotService } from './chat-bot.service'
import {
  SendMessageDto,
  SendCallbackDto,
  ChatResponse,
  ChatSession,
  ChatHistoryEntry,
  ChatUser,
} from './types/chat-bot.types'

/**
 * REST API for testing chat bot without Telegram
 * Available only in development mode
 */
@Controller('api/chat')
export class ChatBotController {
  constructor(private readonly chatBotService: ChatBotService) {}

  /**
   * Send a message to the bot
   * POST /api/chat/message
   */
  @Post('message')
  @HttpCode(HttpStatus.OK)
  async sendMessage(@Body() dto: SendMessageDto): Promise<ChatResponse> {
    const chatUser = this.createChatUser(dto.userId)
    return this.chatBotService.handleMessage(chatUser, dto.text)
  }

  /**
   * Simulate button click (callback)
   * POST /api/chat/callback
   */
  @Post('callback')
  @HttpCode(HttpStatus.OK)
  async sendCallback(@Body() dto: SendCallbackDto): Promise<ChatResponse> {
    const chatUser = this.createChatUser(dto.userId)
    return this.chatBotService.handleCallback(chatUser, dto.data)
  }

  /**
   * Get current session info
   * GET /api/chat/session?userId=xxx
   */
  @Get('session')
  async getSession(@Query('userId') userId: string): Promise<ChatSession | null> {
    const chatUser = this.createChatUser(userId)
    return this.chatBotService.getSession(chatUser)
  }

  /**
   * Get chat history
   * GET /api/chat/history?userId=xxx
   */
  @Get('history')
  getHistory(@Query('userId') userId: string): ChatHistoryEntry[] {
    return this.chatBotService.getHistory(userId)
  }

  /**
   * Clear chat history
   * POST /api/chat/clear
   */
  @Post('clear')
  @HttpCode(HttpStatus.OK)
  clearHistory(@Body() dto: { userId: string }): { success: boolean } {
    this.chatBotService.clearHistory(dto.userId)
    return { success: true }
  }

  /**
   * Create a simulated chat user from userId
   */
  private createChatUser(userId: string): ChatUser {
    // Generate a consistent telegramId from userId
    const telegramId = BigInt(this.hashCode(userId))

    return {
      id: userId,
      telegramId: telegramId < 0 ? -telegramId : telegramId,
      firstName: `User_${userId}`,
      username: userId,
      languageCode: 'ru',
    }
  }

  /**
   * Simple hash function to convert string to number
   */
  private hashCode(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32bit integer
    }
    return hash + 1000000000 // Ensure positive and reasonable Telegram ID range
  }
}
