import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { TelegrafModule } from 'nestjs-telegraf'
import { PrismaModule } from '../../common/prisma/prisma.module'
import { TelegramService } from './telegram.service'
import { StartHandler } from './handlers/start.handler'
import { CommandHandler } from './handlers/command.handler'
import { CallbackHandler } from './handlers/callback.handler'

@Module({
  imports: [
    TelegrafModule.forRootAsync({
      useFactory: (config: ConfigService) => {
        const botToken = config.get<string>('telegram.botToken')

        if (!botToken) {
          throw new Error('TELEGRAM_BOT_TOKEN is required')
        }

        return {
          token: botToken,
          launchOptions:
            process.env.NODE_ENV === 'production'
              ? {
                  webhook: {
                    domain: config.get<string>('telegram.webhookUrl')!,
                    secretToken: config.get<string>('telegram.webhookSecret'),
                  },
                }
              : undefined,
        }
      },
      inject: [ConfigService],
    }),
    PrismaModule,
  ],
  providers: [TelegramService, StartHandler, CommandHandler, CallbackHandler],
  exports: [TelegramService],
})
export class TelegramModule {}
