import { Module } from '@nestjs/common'
import { PrismaModule } from '../../common/prisma/prisma.module'
import { RedisModule } from '../../common/redis/redis.module'
import { LearningSchedulerService } from './learning-scheduler.service'

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [LearningSchedulerService],
  exports: [LearningSchedulerService],
})
export class LearningModule {}
