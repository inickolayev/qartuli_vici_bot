import { Module } from '@nestjs/common'
import { RedisModule } from '../../../common/redis/redis.module'
import { LLMModule } from '../../llm/llm.module'
import { TutorChatService } from './tutor-chat.service'

@Module({
  imports: [RedisModule, LLMModule],
  providers: [TutorChatService],
  exports: [TutorChatService],
})
export class TutorChatModule {}
