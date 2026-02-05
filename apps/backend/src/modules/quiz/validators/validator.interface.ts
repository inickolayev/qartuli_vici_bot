import { VerificationMethod } from '@prisma/client'
import { ValidationContext, ValidatorResult } from '../types/quiz.types'

export interface AnswerValidator {
  readonly method: VerificationMethod

  /**
   * Determines if this validator should run based on context
   */
  shouldRun(context: ValidationContext): boolean

  /**
   * Validates the answer
   * @returns Result with isDefinitive=true if confident about the result
   */
  validate(context: ValidationContext): Promise<ValidatorResult>
}
