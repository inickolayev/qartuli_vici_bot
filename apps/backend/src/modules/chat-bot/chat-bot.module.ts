import { Module } from '@nestjs/common'
import { PrismaModule } from '../../common/prisma/prisma.module'
import { QuizModule } from '../quiz/quiz.module'
import { CollectionsModule } from '../collections/collections.module'
import { SettingsModule } from '../telegram/services/settings.module'
import { ChatBotService } from './chat-bot.service'
import { ChatBotController } from './chat-bot.controller'

@Module({
  imports: [PrismaModule, QuizModule, CollectionsModule, SettingsModule],
  controllers: [ChatBotController],
  providers: [ChatBotService],
  exports: [ChatBotService],
})
export class ChatBotModule {}
