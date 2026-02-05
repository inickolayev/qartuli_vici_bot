import { Injectable } from '@nestjs/common'
import { VerificationMethod } from '@prisma/client'
import { AnswerValidator } from './validator.interface'
import { ValidationContext, ValidatorResult } from '../types/quiz.types'

@Injectable()
export class ExactMatchValidator implements AnswerValidator {
  readonly method = VerificationMethod.EXACT_MATCH

  shouldRun(_context: ValidationContext): boolean {
    return true
  }

  async validate(context: ValidationContext): Promise<ValidatorResult> {
    const userAnswer = context.userAnswer.trim()
    const expectedAnswer = context.expectedAnswer.trim()

    const isCorrect = userAnswer === expectedAnswer
    return {
      isCorrect,
      isDefinitive: isCorrect,
      confidence: isCorrect ? 1.0 : 0,
    }
  }
}
