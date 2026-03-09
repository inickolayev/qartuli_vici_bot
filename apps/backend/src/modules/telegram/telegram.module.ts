import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { TelegrafModule } from 'nestjs-telegraf'
import { PrismaModule } from '../../common/prisma/prisma.module'
import { RedisModule } from '../../common/redis/redis.module'
import { QuizModule } from '../quiz/quiz.module'
import { CollectionsModule } from '../collections/collections.module'
import { WordsModule } from '../words/words.module'
import { LLMModule } from '../llm/llm.module'
import { LearningModule } from '../learning/learning.module'
import { TelegramService } from './telegram.service'
import { StartHandler } from './handlers/start.handler'
import { CommandHandler } from './handlers/command.handler'
import { CallbackHandler } from './handlers/callback.handler'
import { QuizHandler } from './handlers/quiz.handler'
import { AddWordHandler } from './handlers/add-word.handler'
import { BulkImportHandler } from './handlers/bulk-import.handler'
import { SettingsHandler } from './handlers/settings.handler'

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
    RedisModule,
    QuizModule,
    CollectionsModule,
    WordsModule,
    LLMModule,
    LearningModule,
  ],
  providers: [
    TelegramService,
    StartHandler,
    CommandHandler,
    CallbackHandler,
    QuizHandler,
    AddWordHandler,
    BulkImportHandler,
    SettingsHandler,
  ],
  exports: [TelegramService],
})
export class TelegramModule {}
