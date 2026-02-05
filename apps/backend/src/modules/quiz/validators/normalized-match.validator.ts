import { Injectable } from '@nestjs/common'
import { VerificationMethod, ExerciseType } from '@prisma/client'
import { AnswerValidator } from './validator.interface'
import { ValidationContext, ValidatorResult } from '../types/quiz.types'

@Injectable()
export class NormalizedMatchValidator implements AnswerValidator {
  readonly method = VerificationMethod.NORMALIZED_MATCH

  shouldRun(_context: ValidationContext): boolean {
    return true
  }

  async validate(context: ValidationContext): Promise<ValidatorResult> {
    const normalized = this.normalize(context.userAnswer)
    const expected = this.normalize(context.expectedAnswer)

    // For KA_TO_RU: also check alternative Russian translations
    if (context.exerciseType === ExerciseType.KA_TO_RU) {
      const alternatives = context.word.russianAlt.map((alt) => this.normalize(alt))
      const isCorrect = normalized === expected || alternatives.includes(normalized)

      return {
        isCorrect,
        isDefinitive: isCorrect,
        confidence: isCorrect ? 0.95 : 0,
      }
    }

    // For RU_TO_KA: also check Georgian forms
    if (context.exerciseType === ExerciseType.RU_TO_KA) {
      const forms = context.word.georgianForms.map((form) => this.normalize(form))
      const isCorrect = normalized === expected || forms.includes(normalized)

      return {
        isCorrect,
        isDefinitive: isCorrect,
        confidence: isCorrect ? 0.95 : 0,
      }
    }

    const isCorrect = normalized === expected

    return {
      isCorrect,
      isDefinitive: isCorrect,
      confidence: isCorrect ? 0.95 : 0,
    }
  }

  private normalize(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[.,!?;:'"«»„"]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/ё/g, 'е')
  }
}
