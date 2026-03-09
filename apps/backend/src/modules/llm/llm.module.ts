import { Module } from '@nestjs/common'
import { PrismaModule } from '../../common/prisma/prisma.module'
import { LLMService } from './llm.service'

@Module({
  imports: [PrismaModule],
  providers: [LLMService],
  exports: [LLMService],
})
export class LLMModule {}
