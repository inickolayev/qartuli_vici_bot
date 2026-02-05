import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator'
import { QuizSessionType } from '@prisma/client'

export class StartQuizDto {
  @IsOptional()
  @IsEnum(QuizSessionType)
  type?: QuizSessionType = QuizSessionType.MANUAL

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  questionCount?: number = 5
}
