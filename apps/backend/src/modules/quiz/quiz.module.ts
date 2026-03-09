import { Module } from '@nestjs/common'
import { PrismaModule } from '../../common/prisma/prisma.module'
import { RedisModule } from '../../common/redis/redis.module'
import { QuizService } from './quiz.service'
import { WordSelectorService } from './services/word-selector.service'
import { ProgressService } from './services/progress.service'
import { ExerciseGenerator } from './generators/exercise.generator'
import { ExactMatchValidator } from './validators/exact-match.validator'
import { AllowedFormsValidator } from './validators/allowed-forms.validator'
import { NormalizedMatchValidator } from './validators/normalized-match.validator'

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [
    QuizService,
    WordSelectorService,
    ProgressService,
    ExerciseGenerator,
    ExactMatchValidator,
    AllowedFormsValidator,
    NormalizedMatchValidator,
  ],
  exports: [QuizService],
})
export class QuizModule {}
