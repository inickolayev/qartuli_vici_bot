import { Injectable } from '@nestjs/common'
import { ExerciseType } from '@prisma/client'
import { Exercise, WordWithProgress } from '../types/quiz.types'

@Injectable()
export class ExerciseGenerator {
  /**
   * Generate exercise for a word
   * Currently supports KA_TO_RU and RU_TO_KA
   */
  generate(word: WordWithProgress): Exercise {
    // Random selection between the two types
    const exerciseType = Math.random() < 0.5 ? ExerciseType.KA_TO_RU : ExerciseType.RU_TO_KA

    if (exerciseType === ExerciseType.KA_TO_RU) {
      return this.generateKaToRu(word)
    } else {
      return this.generateRuToKa(word)
    }
  }

  private generateKaToRu(word: WordWithProgress): Exercise {
    return {
      type: ExerciseType.KA_TO_RU,
      question: `Переведите на русский:\n\n<b>${word.georgian}</b>`,
      correctAnswer: word.russianPrimary,
      options: [],
      wordId: word.id,
    }
  }

  private generateRuToKa(word: WordWithProgress): Exercise {
    return {
      type: ExerciseType.RU_TO_KA,
      question: `Переведите на грузинский:\n\n<b>${word.russianPrimary}</b>`,
      correctAnswer: word.georgian,
      options: [],
      wordId: word.id,
    }
  }
}
