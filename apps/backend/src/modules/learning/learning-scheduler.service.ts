import { Injectable } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PinoLogger } from 'nestjs-pino'
import { LearningMode, User } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service'
import { RedisService } from '../../common/redis/redis.service'

const MAX_PUSH_PER_DAY = 3
const BATCH_SIZE = 5 // Words per learning push

interface LearningPushPayload {
  userId: string
  telegramId: bigint
  wordsCount: number
  remainingToday: number
  totalToday: number
}

/**
 * Scheduler for automatic learning notifications
 * Sends push notifications to users based on their preferred hours and daily word goal
 */
@Injectable()
export class LearningSchedulerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(LearningSchedulerService.name)
  }

  /**
   * Check every hour for users who need learning push
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkAndPushLearning(): Promise<void> {
    const currentHour = new Date().getUTCHours()

    this.logger.info({ currentHour }, 'Checking for users to push learning')

    try {
      // Find users who:
      // 1. Have learningMode = ACTIVE
      // 2. Have newWordsPerDay > 0
      // 3. Have current hour in preferredHours
      // 4. Haven't reached daily goal yet
      const users = await this.prisma.user.findMany({
        where: {
          learningMode: LearningMode.ACTIVE,
          newWordsPerDay: { gt: 0 },
          preferredHours: { has: currentHour },
        },
      })

      // Filter users who still need words
      const eligibleUsers = users.filter((user) => user.todayNewWordsCount < user.newWordsPerDay)

      this.logger.info(
        { totalUsers: users.length, eligibleUsers: eligibleUsers.length, currentHour },
        'Found users for learning push',
      )

      // Process each user
      for (const user of eligibleUsers) {
        await this.pushLearningSession(user)
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to check learning push')
    }
  }

  /**
   * Reset daily counters at midnight UTC
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async resetDailyCounters(): Promise<void> {
    this.logger.info('Resetting daily learning counters')

    try {
      const result = await this.prisma.user.updateMany({
        where: {
          todayNewWordsCount: { gt: 0 },
        },
        data: {
          todayNewWordsCount: 0,
          todayResetAt: new Date(),
        },
      })

      this.logger.info({ updatedCount: result.count }, 'Daily counters reset')
    } catch (error) {
      this.logger.error({ error }, 'Failed to reset daily counters')
    }
  }

  /**
   * Push learning session to a user
   */
  private async pushLearningSession(user: User): Promise<void> {
    try {
      // Check push rate limit
      const pushCountToday = await this.getPushCountToday(user.id)
      if (pushCountToday >= MAX_PUSH_PER_DAY) {
        this.logger.debug({ userId: user.id, pushCountToday }, 'Max pushes per day reached')
        return
      }

      // Calculate how many words remaining
      const remaining = user.newWordsPerDay - user.todayNewWordsCount
      const batchSize = Math.min(remaining, BATCH_SIZE)

      // Select NEW words from user's collections
      const newWords = await this.selectNewWords(user.id, batchSize)

      if (newWords.length === 0) {
        // No new words available - user has started learning all words
        this.logger.debug({ userId: user.id }, 'No new words available for user')
        return
      }

      // Create learning push payload
      const payload: LearningPushPayload = {
        userId: user.id,
        telegramId: user.telegramId,
        wordsCount: newWords.length,
        remainingToday: remaining - newWords.length,
        totalToday: user.newWordsPerDay,
      }

      // Queue the push notification (to be sent by telegram service)
      await this.queueLearningPush(payload)

      // Increment daily push counter
      await this.incrementPushCount(user.id)

      // Update user's counter and last push time
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          todayNewWordsCount: { increment: newWords.length },
          lastLearningPushAt: new Date(),
        },
      })

      this.logger.info(
        { userId: user.id, wordsCount: newWords.length, remaining: payload.remainingToday },
        'Learning push queued',
      )
    } catch (error) {
      this.logger.error({ error, userId: user.id }, 'Failed to push learning session')
    }
  }

  /**
   * Select NEW words from user's collections
   */
  private async selectNewWords(
    userId: string,
    limit: number,
  ): Promise<{ wordId: string; georgian: string }[]> {
    // Get user's active collections
    const userCollections = await this.prisma.userCollection.findMany({
      where: { userId, isActive: true },
      select: { collectionId: true },
    })

    if (userCollections.length === 0) {
      return []
    }

    const collectionIds = userCollections.map((uc) => uc.collectionId)

    // Get words from collections that are NEW (not started learning yet)
    const collectionWords = await this.prisma.collectionWord.findMany({
      where: {
        collectionId: { in: collectionIds },
        word: {
          userProgress: {
            none: {
              userId,
            },
          },
        },
      },
      include: {
        word: {
          select: { id: true, georgian: true },
        },
      },
      take: limit,
      orderBy: { addedAt: 'asc' },
    })

    return collectionWords.map((cw) => ({
      wordId: cw.word.id,
      georgian: cw.word.georgian,
    }))
  }

  /**
   * Queue learning push notification to Redis
   * TelegramService will pick this up and send the message
   */
  /**
   * Get number of learning pushes sent to user today
   */
  private async getPushCountToday(userId: string): Promise<number> {
    const key = `learning_push_count:${userId}:${this.getTodayKey()}`
    const count = await this.redis.getClient().get(key)
    return count ? parseInt(count, 10) : 0
  }

  /**
   * Increment push count for user today
   */
  private async incrementPushCount(userId: string): Promise<void> {
    const key = `learning_push_count:${userId}:${this.getTodayKey()}`
    await this.redis.getClient().incr(key)
    // Set TTL to expire at end of day (24 hours max)
    await this.redis.getClient().expire(key, 86400)
  }

  /**
   * Get today's date as a key string (YYYY-MM-DD)
   */
  private getTodayKey(): string {
    return new Date().toISOString().slice(0, 10)
  }

  private async queueLearningPush(payload: LearningPushPayload): Promise<void> {
    const key = `learning_push:${payload.userId}`
    await this.redis.setJson(key, payload, 3600) // 1 hour TTL

    // Also add to pending pushes list for batch processing
    await this.redis.getClient().lpush('learning_pushes', JSON.stringify(payload))
  }

  /**
   * Get pending learning push for user (called by TelegramService)
   */
  async getPendingPush(userId: string): Promise<LearningPushPayload | null> {
    const key = `learning_push:${userId}`
    return this.redis.getJson<LearningPushPayload>(key)
  }

  /**
   * Mark push as sent
   */
  async markPushSent(userId: string): Promise<void> {
    const key = `learning_push:${userId}`
    await this.redis.del(key)
  }

  /**
   * Get all pending pushes (for batch processing)
   */
  async getAllPendingPushes(): Promise<LearningPushPayload[]> {
    const client = this.redis.getClient()
    const pushes: LearningPushPayload[] = []

    // Get all items from list
    let item = await client.rpop('learning_pushes')
    while (item) {
      try {
        pushes.push(JSON.parse(item))
      } catch (e) {
        this.logger.warn({ item }, 'Failed to parse learning push')
      }
      item = await client.rpop('learning_pushes')
    }

    return pushes
  }

  /**
   * Check if user has completed daily goal
   */
  async checkDailyGoalCompleted(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { newWordsPerDay: true, todayNewWordsCount: true },
    })

    if (!user) return false

    return user.todayNewWordsCount >= user.newWordsPerDay
  }

  /**
   * Update user's daily word count (called after quiz completion)
   */
  async incrementDailyCount(
    userId: string,
    count: number = 1,
  ): Promise<{ isGoalReached: boolean }> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        todayNewWordsCount: { increment: count },
      },
    })

    return {
      isGoalReached: user.todayNewWordsCount >= user.newWordsPerDay,
    }
  }
}
