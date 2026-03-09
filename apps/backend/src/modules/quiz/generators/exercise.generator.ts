import { Injectable } from '@nestjs/common'
import { ExerciseType, LearningStatus } from '@prisma/client'
import { DistractorService } from '../services/distractor.service'
import {
  Exercise,
  WordWithProgress,
  ExerciseGenerationContext,
  EXERCISE_WEIGHTS_BY_STATUS,
} from '../types/quiz.types'

@Injectable()
export class ExerciseGenerator {
  constructor(private readonly distractorService: DistractorService) {}

  /**
   * Generate exercise for a word based on progress and context
   */
  generate(word: WordWithProgress, context: ExerciseGenerationContext): Exercise {
    const exerciseType = this.selectExerciseType(word, context)

    switch (exerciseType) {
      case ExerciseType.MULTIPLE_CHOICE:
        return this.generateMultipleChoice(word, context)
      case ExerciseType.RU_TO_KA:
        return this.generateRuToKa(word)
      case ExerciseType.KA_TO_RU:
      default:
        return this.generateKaToRu(word)
    }
  }

  /**
   * Select exercise type based on word progress and recent types
   */
  private selectExerciseType(
    word: WordWithProgress,
    context: ExerciseGenerationContext,
  ): ExerciseType {
    // Use preferred type if specified
    if (context.preferredType) {
      return context.preferredType
    }

    // Get weights based on word status
    const status = (word.progress?.status as LearningStatus) || LearningStatus.NEW
    const weights =
      EXERCISE_WEIGHTS_BY_STATUS[status] || EXERCISE_WEIGHTS_BY_STATUS[LearningStatus.NEW]

    // Check if we need variety (avoid same type 3 times in a row)
    const recentTypes = context.recentTypes.slice(-2)
    const lastType = recentTypes[recentTypes.length - 1]
    const secondLastType = recentTypes[recentTypes.length - 2]
    const needsVariety = lastType && lastType === secondLastType

    // Calculate total weight
    let totalWeight =
      weights[ExerciseType.MULTIPLE_CHOICE] +
      weights[ExerciseType.KA_TO_RU] +
      weights[ExerciseType.RU_TO_KA]

    // If need variety, reduce weight of recent type
    const adjustedWeights = { ...weights }
    if (needsVariety && lastType && lastType in adjustedWeights) {
      const key = lastType as keyof typeof adjustedWeights
      adjustedWeights[key] = Math.max(0, (adjustedWeights[key] || 0) - 50)
      totalWeight =
        adjustedWeights[ExerciseType.MULTIPLE_CHOICE] +
        adjustedWeights[ExerciseType.KA_TO_RU] +
        adjustedWeights[ExerciseType.RU_TO_KA]
    }

    // If no words for distractors, skip multiple choice
    if (context.allWords.length < 4) {
      adjustedWeights[ExerciseType.MULTIPLE_CHOICE] = 0
      totalWeight = adjustedWeights[ExerciseType.KA_TO_RU] + adjustedWeights[ExerciseType.RU_TO_KA]
    }

    // Random selection based on weights
    let random = Math.random() * totalWeight

    if (random < adjustedWeights[ExerciseType.MULTIPLE_CHOICE]) {
      return ExerciseType.MULTIPLE_CHOICE
    }
    random -= adjustedWeights[ExerciseType.MULTIPLE_CHOICE]

    if (random < adjustedWeights[ExerciseType.KA_TO_RU]) {
      return ExerciseType.KA_TO_RU
    }

    return ExerciseType.RU_TO_KA
  }

  /**
   * Generate multiple choice exercise
   */
  private generateMultipleChoice(
    word: WordWithProgress,
    context: ExerciseGenerationContext,
  ): Exercise {
    // Decide direction: Georgian -> Russian (easier for beginners)
    const isKaToRu = this.shouldUseKaToRuForMC(word)

    const correctAnswer = isKaToRu ? word.russianPrimary : word.georgian
    const questionWord = isKaToRu ? word.georgian : word.russianPrimary

    // Generate distractors
    const distractors = this.distractorService.generate(word, context.allWords, {
      count: 3,
      direction: isKaToRu ? 'russian' : 'georgian',
    })

    // Combine and shuffle options
    const options = this.shuffle([correctAnswer, ...distractors])

    const questionText = isKaToRu
      ? `Выбери перевод:\n\n<b>${questionWord}</b>`
      : `Выбери грузинское слово:\n\n<b>${questionWord}</b>`

    return {
      type: ExerciseType.MULTIPLE_CHOICE,
      question: questionText,
      correctAnswer,
      options,
      wordId: word.id,
    }
  }

  /**
   * Decide if MC should be Georgian->Russian based on word progress
   */
  private shouldUseKaToRuForMC(word: WordWithProgress): boolean {
    const status = word.progress?.status as LearningStatus

    // NEW and LEARNING words: always Georgian -> Russian (easier)
    if (!status || status === LearningStatus.NEW || status === LearningStatus.LEARNING) {
      return true
    }

    // LEARNED and MASTERED: 50/50 chance
    return Math.random() < 0.5
  }

  private generateKaToRu(word: WordWithProgress): Exercise {
    return {
      type: ExerciseType.KA_TO_RU,
      question: `Переведи на русский:\n\n<b>${word.georgian}</b>`,
      correctAnswer: word.russianPrimary,
      options: [],
      wordId: word.id,
    }
  }

  private generateRuToKa(word: WordWithProgress): Exercise {
    return {
      type: ExerciseType.RU_TO_KA,
      question: `Переведи на грузинский:\n\n<b>${word.russianPrimary}</b>`,
      correctAnswer: word.georgian,
      options: [],
      wordId: word.id,
    }
  }

  /**
   * Fisher-Yates shuffle
   */
  private shuffle<T>(array: T[]): T[] {
    const result = [...array]
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
  }
}
