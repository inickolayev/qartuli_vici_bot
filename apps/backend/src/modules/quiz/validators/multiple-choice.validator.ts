import { Injectable } from '@nestjs/common'
import { ExerciseType, VerificationMethod } from '@prisma/client'
import { AnswerValidator } from './validator.interface'
import { ValidationContext, ValidatorResult } from '../types/quiz.types'

/**
 * Validator for multiple choice questions
 * Simple exact match - user must select the correct option
 */
@Injectable()
export class MultipleChoiceValidator implements AnswerValidator {
  readonly method = VerificationMethod.EXACT_MATCH

  shouldRun(context: ValidationContext): boolean {
    return context.exerciseType === ExerciseType.MULTIPLE_CHOICE
  }

  async validate(context: ValidationContext): Promise<ValidatorResult> {
    const userAnswer = context.userAnswer.trim()
    const expectedAnswer = context.expectedAnswer.trim()

    const isCorrect = userAnswer === expectedAnswer

    return {
      isCorrect,
      isDefinitive: true, // MC is always definitive
      confidence: 1.0,
    }
  }
}
