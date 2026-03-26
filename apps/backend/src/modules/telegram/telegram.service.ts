import { Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import { InjectBot } from 'nestjs-telegraf'
import { Telegraf, Context, Markup } from 'telegraf'
import { RedisService } from '../../common/redis/redis.service'
import { MESSAGES, formatMessage } from './constants/messages'

const BOT_COMMANDS = [
  { command: 'start', description: 'Начать / Главное меню' },
  { command: 'quiz', description: 'Начать квиз' },
  { command: 'add', description: 'Добавить слово: /add გამარჯობა - привет' },
  { command: 'import', description: 'Импорт слов из сообщений' },
  { command: 'settings', description: 'Настройки обучения' },
  { command: 'stats', description: 'Моя статистика' },
  { command: 'collections', description: 'Мои коллекции' },
  { command: 'help', description: 'Помощь' },
]

const PUSH_MSG_KEY_PREFIX = 'learning_push_msg:'
const PUSH_MSG_TTL_SECONDS = 86400 // 24 hours

/**
 * Telegram bot lifecycle management service
 */
@Injectable()
export class TelegramService implements OnModuleInit {
  constructor(
    @InjectBot() private readonly bot: Telegraf<Context>,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(TelegramService.name)
  }

  async onModuleInit() {
    const botToken = this.config.get<string>('telegram.botToken')

    if (!botToken) {
      this.logger.error('TELEGRAM_BOT_TOKEN is not configured')
      throw new Error('TELEGRAM_BOT_TOKEN is required')
    }

    // Register bot commands in Telegram menu
    try {
      await this.bot.telegram.setMyCommands(BOT_COMMANDS)
      this.logger.info({ commands: BOT_COMMANDS.length }, 'Bot commands registered')
    } catch (error) {
      this.logger.error({ error }, 'Failed to register bot commands')
    }

    this.logger.info('Telegram bot service initialized')
  }

  /**
   * Send learning push notification to user.
   * Deletes previous push message first to keep chat clean.
   * Returns message_id on success, null on failure.
   */
  async sendLearningPush(
    telegramId: bigint,
    data: { remaining: number; total: number },
  ): Promise<number | null> {
    try {
      // Delete previous push message (best-effort)
      await this.deletePreviousLearningPush(telegramId)

      const message = formatMessage(MESSAGES.LEARNING_PUSH, {
        remaining: data.remaining,
        total: data.total,
      })

      const sentMessage = await this.bot.telegram.sendMessage(telegramId.toString(), message, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🎯 Начать квиз', 'quiz:start')],
          [Markup.button.callback('⏸ Пауза', 'settings:pause')],
        ]),
      })

      // Store new message_id in Redis
      await this.storePushMessageId(telegramId, sentMessage.message_id)

      this.logger.info({ telegramId: telegramId.toString() }, 'Learning push sent')
      return sentMessage.message_id
    } catch (error) {
      this.logger.error(
        { error, telegramId: telegramId.toString() },
        'Failed to send learning push',
      )
      return null
    }
  }

  /**
   * Delete previous learning push message from chat (best-effort).
   * Silently ignores all errors (message deleted by user, bot blocked, etc.)
   */
  private async deletePreviousLearningPush(telegramId: bigint): Promise<void> {
    try {
      const key = this.getPushMsgKey(telegramId)
      const storedMessageId = await this.redis.getClient().get(key)

      if (!storedMessageId) {
        return
      }

      const messageId = parseInt(storedMessageId, 10)
      await this.bot.telegram.deleteMessage(telegramId.toString(), messageId)
      await this.redis.getClient().del(key)

      this.logger.debug(
        { telegramId: telegramId.toString(), messageId },
        'Previous learning push deleted',
      )
    } catch {
      // Best-effort: message may be already deleted, bot blocked, etc.
    }
  }

  /**
   * Store push message_id in Redis with 24h TTL
   */
  private async storePushMessageId(telegramId: bigint, messageId: number): Promise<void> {
    try {
      const key = this.getPushMsgKey(telegramId)
      await this.redis.getClient().set(key, messageId.toString(), 'EX', PUSH_MSG_TTL_SECONDS)
    } catch {
      // Non-critical: if Redis fails, next push just won't delete this one
    }
  }

  private getPushMsgKey(telegramId: bigint): string {
    return `${PUSH_MSG_KEY_PREFIX}${telegramId}`
  }
}
