import { Injectable, Inject, forwardRef } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PinoLogger } from 'nestjs-pino'
import { LearningMode, User } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service'
import { RedisService } from '../../common/redis/redis.service'
import { TelegramService } from '../telegram/telegram.service'

const MAX_PUSH_PER_DAY = 50 // Increased for frequent intervals
const STALE_SESSION_HOURS = 1 // Auto-abandon sessions older than this

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
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(LearningSchedulerService.name)
  }

  /**
   * Check every 5 minutes for users who need learning push
   */
  @Cron('*/5 * * * *') // Every 5 minutes
  async checkAndPushLearning(): Promise<void> {
    const now = new Date()
    const currentHour = now.getUTCHours()

    this.logger.debug({ currentHour }, 'Checking for users to push learning')

    try {
      // Auto-abandon stale quiz sessions (older than 1 hour)
      await this.abandonStaleSessions()

      // Find all active users
      const users = await this.prisma.user.findMany({
        where: {
          learningMode: LearningMode.ACTIVE,
          newWordsPerDay: { gt: 0 },
        },
      })

      // Filter users based on their settings
      const eligibleUsers = users.filter((user) => {
        // Check if daily goal not reached
        if (user.todayNewWordsCount >= user.newWordsPerDay) {
          return false
        }

        if (user.pushIntervalMinutes > 0) {
          // Interval mode: check active hours and interval
          if (!this.isWithinActiveHours(currentHour, user.activeHoursStart, user.activeHoursEnd)) {
            return false
          }

          // Check if enough time has passed since last push
          if (user.lastLearningPushAt) {
            const timeSinceLastPush = now.getTime() - user.lastLearningPushAt.getTime()
            const intervalMs = user.pushIntervalMinutes * 60 * 1000
            if (timeSinceLastPush < intervalMs) {
              return false
            }
          }
          return true
        } else {
          // Preferred hours mode: check if current hour matches and hasn't been pushed this hour
          if (!user.preferredHours.includes(currentHour)) {
            return false
          }

          // Check if already pushed this hour
          if (user.lastLearningPushAt) {
            const lastPushHour = user.lastLearningPushAt.getUTCHours()
            const lastPushDate = user.lastLearningPushAt.toDateString()
            const todayDate = now.toDateString()
            if (lastPushHour === currentHour && lastPushDate === todayDate) {
              return false
            }
          }
          return true
        }
      })

      if (eligibleUsers.length > 0) {
        this.logger.info(
          { totalUsers: users.length, eligibleUsers: eligibleUsers.length, currentHour },
          'Found users for learning push',
        )
      }

      // Process each user
      for (const user of eligibleUsers) {
        await this.pushLearningSession(user)
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to check learning push')
    }
  }

  /**
   * Check if current hour is within active hours range
   */
  private isWithinActiveHours(currentHour: number, start: number, end: number): boolean {
    if (start <= end) {
      // Normal range: e.g., 8-22
      return currentHour >= start && currentHour < end
    } else {
      // Overnight range: e.g., 22-8 (not typical but handle it)
      return currentHour >= start || currentHour < end
    }
  }

  /**
   * Reset daily counters at midnight UTC
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async resetDailyCounters(): Promise<void> {
    this.logger.info('Resetting daily learning counters')

    try {
      // Reset user daily counts
      const userResult = await this.prisma.user.updateMany({
        where: {
          todayNewWordsCount: { gt: 0 },
        },
        data: {
          todayNewWordsCount: 0,
          todayResetAt: new Date(),
        },
      })

      // Reset word mastery flags for new day
      const progressResult = await this.prisma.userWordProgress.updateMany({
        where: {
          masteredToday: true,
        },
        data: {
          masteredToday: false,
          consecutiveCorrect: 0,
        },
      })

      this.logger.info(
        { usersReset: userResult.count, progressReset: progressResult.count },
        'Daily counters reset',
      )
    } catch (error) {
      this.logger.error({ error }, 'Failed to reset daily counters')
    }
  }

  /**
   * Auto-abandon quiz sessions that have been inactive for too long
   */
  private async abandonStaleSessions(): Promise<void> {
    const staleThreshold = new Date(Date.now() - STALE_SESSION_HOURS * 60 * 60 * 1000)

    try {
      const result = await this.prisma.quizSession.updateMany({
        where: {
          status: 'IN_PROGRESS',
          startedAt: { lt: staleThreshold },
        },
        data: {
          status: 'ABANDONED',
        },
      })

      if (result.count > 0) {
        this.logger.info({ count: result.count }, 'Auto-abandoned stale quiz sessions')
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to abandon stale sessions')
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

      // Check if user has active quiz session - don't disturb
      const activeSession = await this.prisma.quizSession.findFirst({
        where: {
          userId: user.id,
          status: 'IN_PROGRESS',
        },
      })

      if (activeSession) {
        this.logger.debug({ userId: user.id }, 'User has active quiz session, skipping push')
        return
      }

      // Calculate how many words remaining for today's goal
      const remaining = user.newWordsPerDay - user.todayNewWordsCount

      // Send push notification
      const sent = await this.telegramService.sendLearningPush(user.telegramId, {
        remaining,
        total: user.newWordsPerDay,
      })

      if (!sent) {
        this.logger.warn({ userId: user.id }, 'Failed to send learning push')
        return
      }

      // Increment daily push counter
      await this.incrementPushCount(user.id)

      // Update last push time
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          lastLearningPushAt: new Date(),
        },
      })

      this.logger.info(
        { userId: user.id, remaining, total: user.newWordsPerDay },
        'Learning push sent',
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
