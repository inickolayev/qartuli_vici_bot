import { Injectable } from '@nestjs/common'
import { WordWithProgress, DistractorConfig } from '../types/quiz.types'

@Injectable()
export class DistractorService {
  /**
   * Generate distractors (wrong answer options) for multiple choice questions
   */
  generate(
    targetWord: WordWithProgress,
    wordPool: WordWithProgress[],
    config: DistractorConfig,
  ): string[] {
    const { count, direction } = config

    // Get the correct answer to exclude
    const correctAnswer = direction === 'russian' ? targetWord.russianPrimary : targetWord.georgian

    // Filter out the target word and get candidates
    const candidates = wordPool
      .filter((w) => w.id !== targetWord.id)
      .map((w) => (direction === 'russian' ? w.russianPrimary : w.georgian))
      .filter((answer) => {
        // Exclude answers too similar to correct answer
        if (answer === correctAnswer) return false
        if (answer.toLowerCase() === correctAnswer.toLowerCase()) return false
        // Exclude if one is substring of another (>50% length)
        if (this.isTooSimilar(answer, correctAnswer)) return false
        return true
      })

    // Shuffle and take required count
    const shuffled = this.shuffle(candidates)
    const distractors = shuffled.slice(0, count)

    // If not enough distractors from pool, use fallback
    if (distractors.length < count) {
      const fallback = this.getFallbackDistractors(direction, correctAnswer)
      const needed = count - distractors.length
      const additional = fallback
        .filter((d) => !distractors.includes(d) && d !== correctAnswer)
        .slice(0, needed)
      distractors.push(...additional)
    }

    return distractors
  }

  /**
   * Check if two strings are too similar (one contains significant part of another)
   */
  private isTooSimilar(a: string, b: string): boolean {
    const aLower = a.toLowerCase()
    const bLower = b.toLowerCase()
    const minLen = Math.min(a.length, b.length)

    // If one contains the other and it's more than 50% of the shorter string
    if (aLower.includes(bLower) || bLower.includes(aLower)) {
      return minLen > 2
    }

    return false
  }

  /**
   * Fallback distractors for when word pool is too small
   */
  private getFallbackDistractors(direction: 'russian' | 'georgian', exclude: string): string[] {
    if (direction === 'russian') {
      return [
        'дом',
        'вода',
        'хлеб',
        'день',
        'ночь',
        'солнце',
        'луна',
        'друг',
        'мама',
        'папа',
        'кошка',
        'собака',
        'книга',
        'стол',
        'окно',
      ].filter((w) => w !== exclude)
    } else {
      return [
        'სახლი',
        'წყალი',
        'პური',
        'დღე',
        'ღამე',
        'მზე',
        'მთვარე',
        'მეგობარი',
        'დედა',
        'მამა',
        'კატა',
        'ძაღლი',
        'წიგნი',
        'მაგიდა',
        'ფანჯარა',
      ].filter((w) => w !== exclude)
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
