import { Module, forwardRef } from '@nestjs/common'
import { PrismaModule } from '../../common/prisma/prisma.module'
import { RedisModule } from '../../common/redis/redis.module'
import { TelegramModule } from '../telegram/telegram.module'
import { LearningSchedulerService } from './learning-scheduler.service'

@Module({
  imports: [PrismaModule, RedisModule, forwardRef(() => TelegramModule)],
  providers: [LearningSchedulerService],
  exports: [LearningSchedulerService],
})
export class LearningModule {}
