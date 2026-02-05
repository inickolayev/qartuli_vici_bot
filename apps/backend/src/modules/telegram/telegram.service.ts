import { Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'

/**
 * Telegram bot lifecycle management service
 */
@Injectable()
export class TelegramService implements OnModuleInit {
  constructor(
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

    this.logger.info('Telegram bot service initialized')
  }
}
