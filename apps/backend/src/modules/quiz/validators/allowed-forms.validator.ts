import { Injectable } from '@nestjs/common'
import { ExerciseType, VerificationMethod } from '@prisma/client'
import { AnswerValidator } from './validator.interface'
import { ValidationContext, ValidatorResult } from '../types/quiz.types'

/**
 * Validates answers against alternative forms:
 * - For KA_TO_RU: checks if answer matches any of russianAlt
 * - For RU_TO_KA: checks if answer matches any of georgianForms
 */
@Injectable()
export class AllowedFormsValidator implements AnswerValidator {
  readonly method = VerificationMethod.ALLOWED_FORMS

  shouldRun(context: ValidationContext): boolean {
    if (context.exerciseType === ExerciseType.KA_TO_RU) {
      return context.word.russianAlt.length > 0
    }
    if (context.exerciseType === ExerciseType.RU_TO_KA) {
      return context.word.georgianForms.length > 0
    }
    return false
  }

  async validate(context: ValidationContext): Promise<ValidatorResult> {
    const userAnswer = context.userAnswer.trim().toLowerCase()

    if (context.exerciseType === ExerciseType.KA_TO_RU) {
      const isCorrect = context.word.russianAlt.some(
        (alt) => alt.trim().toLowerCase() === userAnswer,
      )
      return {
        isCorrect,
        isDefinitive: isCorrect,
        confidence: isCorrect ? 0.98 : 0,
      }
    }

    if (context.exerciseType === ExerciseType.RU_TO_KA) {
      const isCorrect = context.word.georgianForms.some(
        (form) => form.trim().toLowerCase() === userAnswer,
      )
      return {
        isCorrect,
        isDefinitive: isCorrect,
        confidence: isCorrect ? 0.98 : 0,
      }
    }

    return {
      isCorrect: false,
      isDefinitive: false,
      confidence: 0,
    }
  }
}
