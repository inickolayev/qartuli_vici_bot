import { Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { LearningStatus } from '@prisma/client'
import { PrismaService } from '../../../common/prisma/prisma.service'

const MASTERY_STREAK_THRESHOLD = 3 // 3 correct answers in a row to count as mastered today

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ProgressService.name)
  }

  /**
   * Update user word progress after quiz answer
   * Returns true if word was newly mastered today (for daily count)
   */
  async updateProgress(
    userId: string,
    wordId: string,
    isCorrect: boolean,
  ): Promise<{ masteredToday: boolean }> {
    try {
      const now = new Date()
      let newlyMasteredToday = false

      const existing = await this.prisma.userWordProgress.findUnique({
        where: {
          userId_wordId: {
            userId,
            wordId,
          },
        },
      })

      if (existing) {
        // Calculate new streak
        const newConsecutiveCorrect = isCorrect ? existing.consecutiveCorrect + 1 : 0

        // Check if just reached mastery threshold
        const shouldCountToday =
          newConsecutiveCorrect >= MASTERY_STREAK_THRESHOLD && !existing.masteredToday

        if (shouldCountToday) {
          newlyMasteredToday = true
          // Increment user's daily count
          await this.prisma.user.update({
            where: { id: userId },
            data: { todayNewWordsCount: { increment: 1 } },
          })
        }

        const updated = await this.prisma.userWordProgress.update({
          where: { id: existing.id },
          data: {
            ...this.calculateProgressUpdate(existing, isCorrect, now),
            consecutiveCorrect: newConsecutiveCorrect,
            masteredToday: existing.masteredToday || shouldCountToday,
          },
        })

        this.logger.debug(
          {
            userId,
            wordId,
            isCorrect,
            oldRating: existing.rating,
            newRating: updated.rating,
            consecutiveCorrect: newConsecutiveCorrect,
            newlyMasteredToday,
          },
          'Progress updated',
        )
      } else {
        // First time seeing this word
        await this.prisma.userWordProgress.create({
          data: {
            userId,
            wordId,
            rating: isCorrect ? 1 : 0,
            correctCount: isCorrect ? 1 : 0,
            incorrectCount: isCorrect ? 0 : 1,
            totalAttempts: 1,
            consecutiveCorrect: isCorrect ? 1 : 0,
            masteredToday: false,
            lastSeenAt: now,
            lastCorrectAt: isCorrect ? now : null,
            lastIncorrectAt: isCorrect ? null : now,
            nextReviewAt: this.calculateNextReview(isCorrect ? 1 : 0),
            status: isCorrect ? LearningStatus.LEARNING : LearningStatus.NEW,
          },
        })

        this.logger.debug({ userId, wordId, isCorrect }, 'New progress created')
      }

      return { masteredToday: newlyMasteredToday }
    } catch (error) {
      this.logger.error({ error, userId, wordId }, 'Failed to update progress')
      throw error
    }
  }

  /**
   * Calculate progress update data
   */
  private calculateProgressUpdate(
    existing: {
      rating: number
      correctCount: number
      incorrectCount: number
      totalAttempts: number
      status: LearningStatus
    },
    isCorrect: boolean,
    now: Date,
  ) {
    const newRating = isCorrect
      ? Math.min(existing.rating + 1, 10)
      : Math.max(existing.rating - 1, 0)

    const newStatus = this.calculateStatus(newRating, isCorrect)

    return {
      rating: newRating,
      correctCount: isCorrect ? existing.correctCount + 1 : existing.correctCount,
      incorrectCount: isCorrect ? existing.incorrectCount : existing.incorrectCount + 1,
      totalAttempts: existing.totalAttempts + 1,
      lastSeenAt: now,
      ...(isCorrect ? { lastCorrectAt: now } : { lastIncorrectAt: now }),
      nextReviewAt: this.calculateNextReview(newRating),
      status: newStatus,
    }
  }

  /**
   * Calculate learning status based on rating
   */
  private calculateStatus(rating: number, isCorrect: boolean): LearningStatus {
    if (rating >= 8) return LearningStatus.MASTERED
    if (rating >= 4) return LearningStatus.LEARNED
    if (rating > 0 || isCorrect) return LearningStatus.LEARNING
    return LearningStatus.NEW
  }

  /**
   * Calculate next review time using spaced repetition intervals
   */
  private calculateNextReview(rating: number): Date {
    const now = new Date()

    // Spaced repetition intervals in hours
    const intervals = [1, 4, 12, 24, 48, 96, 192, 384, 768, 1536]

    const intervalHours = intervals[Math.min(rating, intervals.length - 1)]
    return new Date(now.getTime() + intervalHours * 60 * 60 * 1000)
  }
}
