import { Module, forwardRef } from '@nestjs/common'
import { PrismaModule } from '../../common/prisma/prisma.module'
import { RedisModule } from '../../common/redis/redis.module'
import { TelegramModule } from '../telegram/telegram.module'
import { TutorChatModule } from '../telegram/services/tutor-chat.module'
import { LearningSchedulerService } from './learning-scheduler.service'

@Module({
  imports: [PrismaModule, RedisModule, forwardRef(() => TelegramModule), TutorChatModule],
  providers: [LearningSchedulerService],
  exports: [LearningSchedulerService],
})
export class LearningModule {}
