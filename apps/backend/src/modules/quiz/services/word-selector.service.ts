import { Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { LearningStatus } from '@prisma/client'
import { PrismaService } from '../../../common/prisma/prisma.service'
import { WordWithProgress } from '../types/quiz.types'

@Injectable()
export class WordSelectorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(WordSelectorService.name)
  }

  /**
   * Select words for quiz using priority scoring
   * Priority: NEW > LEARNING (low rating) > LEARNED > MASTERED
   */
  async selectWords(userId: string, count: number): Promise<WordWithProgress[]> {
    try {
      // Get all words from user's active collections with progress
      const userCollections = await this.prisma.userCollection.findMany({
        where: {
          userId,
          isActive: true,
        },
        include: {
          collection: {
            include: {
              words: {
                include: {
                  word: {
                    include: {
                      userProgress: {
                        where: { userId },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })

      // Flatten and transform to WordWithProgress, removing duplicates
      const wordMap = new Map<string, WordWithProgress>()

      for (const userCollection of userCollections) {
        for (const collectionWord of userCollection.collection.words) {
          const word = collectionWord.word
          const progress = word.userProgress[0]

          if (!wordMap.has(word.id)) {
            wordMap.set(word.id, {
              id: word.id,
              georgian: word.georgian,
              russianPrimary: word.russianPrimary,
              russianAlt: word.russianAlt,
              georgianForms: word.georgianForms,
              difficulty: word.difficulty,
              progress: progress
                ? {
                    id: progress.id,
                    rating: progress.rating,
                    status: progress.status,
                    correctCount: progress.correctCount,
                    incorrectCount: progress.incorrectCount,
                    totalAttempts: progress.totalAttempts,
                    consecutiveCorrect: progress.consecutiveCorrect,
                    masteredToday: progress.masteredToday,
                    lastSeenAt: progress.lastSeenAt,
                    lastCorrectAt: progress.lastCorrectAt,
                    lastIncorrectAt: progress.lastIncorrectAt,
                    nextReviewAt: progress.nextReviewAt,
                  }
                : undefined,
            })
          }
        }
      }

      const allWords = Array.from(wordMap.values())

      if (allWords.length === 0) {
        this.logger.warn({ userId }, 'No words found in active collections')
        return []
      }

      // Calculate priority scores
      const wordsWithScores = allWords.map((word) => ({
        word,
        score: this.calculatePriorityScore(word),
      }))

      // Weighted random selection
      const selected = this.weightedRandomSelection(wordsWithScores, count)

      this.logger.info(
        { userId, totalWords: allWords.length, selectedCount: selected.length },
        'Words selected for quiz',
      )

      return selected
    } catch (error) {
      this.logger.error({ error, userId }, 'Failed to select words')
      throw error
    }
  }

  /**
   * Calculate priority score for a word
   * Higher score = higher priority
   * Includes streak bonus for words close to daily mastery
   */
  private calculatePriorityScore(word: WordWithProgress): number {
    if (!word.progress) {
      return 100 // NEW words without progress
    }

    const { status, rating, consecutiveCorrect, masteredToday } = word.progress

    // Already counted toward today's goal - very low priority
    if (masteredToday) {
      return 5
    }

    // Base score by status
    let baseScore: number
    switch (status) {
      case LearningStatus.NEW:
        baseScore = 100
        break
      case LearningStatus.LEARNING:
        baseScore = Math.max(50 - rating * 5, 10)
        break
      case LearningStatus.LEARNED:
        baseScore = 20
        break
      case LearningStatus.MASTERED:
        baseScore = 10
        break
      default:
        baseScore = 50
    }

    // Streak bonus: +20 per consecutive correct answer
    // consecutiveCorrect=2 means just 1 more correct to count!
    const streakBonus = consecutiveCorrect * 20

    return baseScore + streakBonus
  }

  /**
   * Weighted random selection
   */
  private weightedRandomSelection(
    wordsWithScores: Array<{ word: WordWithProgress; score: number }>,
    count: number,
  ): WordWithProgress[] {
    if (wordsWithScores.length <= count) {
      return wordsWithScores.map((w) => w.word)
    }

    const selected: WordWithProgress[] = []
    const remaining = [...wordsWithScores]

    while (selected.length < count && remaining.length > 0) {
      const totalScore = remaining.reduce((sum, w) => sum + w.score, 0)
      let random = Math.random() * totalScore
      let selectedIndex = 0

      for (let i = 0; i < remaining.length; i++) {
        random -= remaining[i].score
        if (random <= 0) {
          selectedIndex = i
          break
        }
      }

      selected.push(remaining[selectedIndex].word)
      remaining.splice(selectedIndex, 1)
    }

    return selected
  }
}
