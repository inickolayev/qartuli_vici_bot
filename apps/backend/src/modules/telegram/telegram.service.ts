import { Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import { InjectBot } from 'nestjs-telegraf'
import { Telegraf, Context, Markup } from 'telegraf'
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

/**
 * Telegram bot lifecycle management service
 */
@Injectable()
export class TelegramService implements OnModuleInit {
  constructor(
    @InjectBot() private readonly bot: Telegraf<Context>,
    private readonly config: ConfigService,
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
   * Send learning push notification to user
   */
  async sendLearningPush(
    telegramId: bigint,
    data: { remaining: number; total: number },
  ): Promise<boolean> {
    try {
      const message = formatMessage(MESSAGES.LEARNING_PUSH, {
        remaining: data.remaining,
        total: data.total,
      })

      await this.bot.telegram.sendMessage(telegramId.toString(), message, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🎯 Начать квиз', 'quiz:start')],
          [Markup.button.callback('⏸ Пауза', 'settings:pause')],
        ]),
      })

      this.logger.info({ telegramId: telegramId.toString() }, 'Learning push sent')
      return true
    } catch (error) {
      this.logger.error(
        { error, telegramId: telegramId.toString() },
        'Failed to send learning push',
      )
      return false
    }
  }
}
