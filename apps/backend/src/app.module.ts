import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { ScheduleModule } from '@nestjs/schedule'
import { LoggerModule } from 'nestjs-pino'

import { PrismaModule } from './common/prisma/prisma.module'
import { RedisModule } from './common/redis/redis.module'
import { HealthModule } from './modules/health/health.module'
import { TelegramModule } from './modules/telegram/telegram.module'
import { WordsModule } from './modules/words/words.module'
import { CollectionsModule } from './modules/collections/collections.module'
import { QuizModule } from './modules/quiz/quiz.module'
import { LLMModule } from './modules/llm/llm.module'
import { LearningModule } from './modules/learning/learning.module'
import { ChatBotModule } from './modules/chat-bot/chat-bot.module'

import { appConfig, validateConfig } from './config/app.config'

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validate: validateConfig,
    }),

    // Logging
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  singleLine: true,
                },
              }
            : undefined,
        level: process.env.LOG_LEVEL || 'info',
        autoLogging: {
          ignore: (req) => req.url === '/health',
        },
      },
    }),

    // Core modules
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),

    // Database & Cache
    PrismaModule,
    RedisModule,

    // Feature modules
    HealthModule,
    TelegramModule,
    WordsModule,
    CollectionsModule,
    QuizModule,
    LLMModule,
    LearningModule,

    // Development modules (chat testing interface)
    ...(process.env.NODE_ENV !== 'production' ? [ChatBotModule] : []),
  ],
})
export class AppModule {}
