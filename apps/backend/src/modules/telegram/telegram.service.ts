import { Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import { InjectBot } from 'nestjs-telegraf'
import { Telegraf, Context } from 'telegraf'

const BOT_COMMANDS = [
  { command: 'start', description: 'Начать / Главное меню' },
  { command: 'quiz', description: 'Начать квиз' },
  { command: 'add', description: 'Добавить слово: /add გამარჯობა - привет' },
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
}
