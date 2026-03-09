import { Injectable } from '@nestjs/common'
import { Action, Command, Ctx, Update } from 'nestjs-telegraf'
import { Context, Markup } from 'telegraf'
import { PinoLogger } from 'nestjs-pino'
import { PrismaService } from '../../../common/prisma/prisma.service'
import { MESSAGES, formatMessage } from '../constants/messages'
import { LearningStatus, QuizSessionStatus } from '@prisma/client'

const WORDS_PER_PAGE = 10

interface UserStats {
  // User info
  xp: number
  level: number
  currentStreak: number
  longestStreak: number

  // Word progress
  totalWords: number
  newWords: number
  learningWords: number
  learnedWords: number
  masteredWords: number

  // Quiz stats
  totalQuizzes: number
  totalAnswers: number
  correctAnswers: number
  accuracy: number

  // Today stats
  todayQuizzes: number
  todayCorrect: number
  todayXp: number
}

@Update()
@Injectable()
export class StatsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(StatsHandler.name)
  }

  @Command('stats')
  @Action('stats:show')
  async onShowStats(@Ctx() ctx: Context) {
    try {
      const from = ctx.from
      if (!from) {
        await ctx.reply(MESSAGES.ERROR_NOT_REGISTERED)
        return
      }

      const user = await this.prisma.user.findUnique({
        where: { telegramId: BigInt(from.id) },
      })

      if (!user) {
        await ctx.reply(MESSAGES.ERROR_NOT_REGISTERED)
        return
      }

      const stats = await this.getUserStats(user.id)
      const message = this.formatStatsMessage(stats)

      const keyboard = this.createStatsKeyboard()

      if (ctx.callbackQuery) {
        await ctx.editMessageText(message, {
          parse_mode: 'HTML',
          ...keyboard,
        })
        await ctx.answerCbQuery()
      } else {
        await ctx.reply(message, {
          parse_mode: 'HTML',
          ...keyboard,
        })
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to show stats')
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery(MESSAGES.ERROR_GENERIC)
      } else {
        await ctx.reply(MESSAGES.ERROR_GENERIC)
      }
    }
  }

  @Action(/^words:list:(\d+)$/)
  async onWordsList(@Ctx() ctx: Context) {
    try {
      const from = ctx.from
      if (!from) return

      const callbackData = 'data' in ctx.callbackQuery! ? ctx.callbackQuery.data : ''
      const match = callbackData.match(/^words:list:(\d+)$/)
      const page = match ? parseInt(match[1], 10) : 0

      const user = await this.prisma.user.findUnique({
        where: { telegramId: BigInt(from.id) },
      })

      if (!user) {
        await ctx.answerCbQuery(MESSAGES.ERROR_NOT_REGISTERED)
        return
      }

      const { words, total, totalPages } = await this.getUserWords(user.id, page)

      if (total === 0) {
        await ctx.editMessageText(MESSAGES.WORDS_LIST_EMPTY, {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('« Назад к статистике', 'stats:show')],
          ]),
        })
        await ctx.answerCbQuery()
        return
      }

      const message = this.formatWordsListMessage(words, page, total, totalPages)
      const keyboard = this.createWordsListKeyboard(page, totalPages)

      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        ...keyboard,
      })
      await ctx.answerCbQuery()
    } catch (error) {
      this.logger.error({ error }, 'Failed to show words list')
      await ctx.answerCbQuery(MESSAGES.ERROR_GENERIC)
    }
  }

  @Action('noop')
  async onNoop(@Ctx() ctx: Context) {
    await ctx.answerCbQuery()
  }

  @Action('words:inprogress')
  async onWordsInProgress(@Ctx() ctx: Context) {
    try {
      const from = ctx.from
      if (!from) return

      const user = await this.prisma.user.findUnique({
        where: { telegramId: BigInt(from.id) },
      })

      if (!user) {
        await ctx.answerCbQuery(MESSAGES.ERROR_NOT_REGISTERED)
        return
      }

      // Get words with streak > 0 that are not yet mastered today
      const inProgressWords = await this.prisma.userWordProgress.findMany({
        where: {
          userId: user.id,
          consecutiveCorrect: { gt: 0 },
          masteredToday: false,
        },
        include: {
          word: true,
        },
        orderBy: {
          consecutiveCorrect: 'desc',
        },
        take: 15,
      })

      // Get words already mastered today
      const masteredTodayWords = await this.prisma.userWordProgress.findMany({
        where: {
          userId: user.id,
          masteredToday: true,
        },
        include: {
          word: true,
        },
        take: 10,
      })

      const message = this.formatInProgressMessage(
        inProgressWords,
        masteredTodayWords,
        user.todayNewWordsCount,
        user.newWordsPerDay,
      )

      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('« Назад к статистике', 'stats:show')]]),
      })
      await ctx.answerCbQuery()
    } catch (error) {
      this.logger.error({ error }, 'Failed to show in-progress words')
      await ctx.answerCbQuery(MESSAGES.ERROR_GENERIC)
    }
  }

  private formatInProgressMessage(
    inProgress: Array<{
      consecutiveCorrect: number
      word: { georgian: string; russianPrimary: string }
    }>,
    masteredToday: Array<{
      word: { georgian: string; russianPrimary: string }
    }>,
    todayCount: number,
    dailyGoal: number,
  ): string {
    let message = `🔥 <b>Прогресс за сегодня</b>\n\n`
    message += `📊 Засчитано: <b>${todayCount}/${dailyGoal}</b> слов\n\n`

    if (inProgress.length > 0) {
      message += `⏳ <b>В процессе</b> (нужно добить):\n`
      for (const wp of inProgress) {
        const remaining = 3 - wp.consecutiveCorrect
        const streakBar = '✅'.repeat(wp.consecutiveCorrect) + '⬜'.repeat(remaining)
        message += `${streakBar} <b>${wp.word.georgian}</b> — ${wp.word.russianPrimary}\n`
      }
      message += '\n'
    } else {
      message += `⏳ Нет слов в процессе\n\n`
    }

    if (masteredToday.length > 0) {
      message += `✅ <b>Засчитано сегодня:</b>\n`
      for (const wp of masteredToday) {
        message += `✅✅✅ <b>${wp.word.georgian}</b> — ${wp.word.russianPrimary}\n`
      }
    }

    if (inProgress.length === 0 && masteredToday.length === 0) {
      message += `💡 Начни квиз, чтобы учить новые слова!`
    }

    return message
  }

  private createStatsKeyboard() {
    return Markup.inlineKeyboard([
      [Markup.button.callback('🔥 В процессе', 'words:inprogress')],
      [Markup.button.callback('📚 Мои слова', 'words:list:0')],
      [Markup.button.callback('« Назад', 'menu:main')],
    ])
  }

  private async getUserStats(userId: string): Promise<UserStats> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new Error('User not found')
    }

    // Get word progress counts
    const wordProgress = await this.prisma.userWordProgress.groupBy({
      by: ['status'],
      where: { userId },
      _count: { status: true },
    })

    const statusCounts = wordProgress.reduce(
      (acc, item) => {
        acc[item.status] = item._count.status
        return acc
      },
      {} as Record<LearningStatus, number>,
    )

    // Get total available words for user (from their collections)
    const totalWords = await this.prisma.word.count({
      where: {
        collections: {
          some: {
            collection: {
              users: {
                some: { userId, isActive: true },
              },
            },
          },
        },
      },
    })

    // Get quiz statistics
    const completedQuizzes = await this.prisma.quizSession.count({
      where: {
        userId,
        status: QuizSessionStatus.COMPLETED,
      },
    })

    const totalAnswers = await this.prisma.quizAnswer.count({
      where: {
        session: { userId },
        isCorrect: { not: null },
      },
    })

    const correctAnswers = await this.prisma.quizAnswer.count({
      where: {
        session: { userId },
        isCorrect: true,
      },
    })

    // Get today's stats
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const todayQuizzes = await this.prisma.quizSession.count({
      where: {
        userId,
        status: QuizSessionStatus.COMPLETED,
        completedAt: { gte: todayStart },
      },
    })

    const todayCorrectCount = await this.prisma.quizAnswer.count({
      where: {
        session: {
          userId,
          completedAt: { gte: todayStart },
        },
        isCorrect: true,
      },
    })

    const todaySessions = await this.prisma.quizSession.aggregate({
      where: {
        userId,
        status: QuizSessionStatus.COMPLETED,
        completedAt: { gte: todayStart },
      },
      _sum: { xpEarned: true },
    })

    return {
      xp: user.xp,
      level: user.level,
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,

      totalWords,
      newWords: statusCounts[LearningStatus.NEW] || 0,
      learningWords: statusCounts[LearningStatus.LEARNING] || 0,
      learnedWords: statusCounts[LearningStatus.LEARNED] || 0,
      masteredWords: statusCounts[LearningStatus.MASTERED] || 0,

      totalQuizzes: completedQuizzes,
      totalAnswers,
      correctAnswers,
      accuracy: totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0,

      todayQuizzes,
      todayCorrect: todayCorrectCount,
      todayXp: todaySessions._sum?.xpEarned || 0,
    }
  }

  private formatStatsMessage(stats: UserStats): string {
    const progressBar = this.createProgressBar(stats.accuracy)
    const wordProgressBar = this.createWordProgressBar(stats)

    return formatMessage(MESSAGES.STATS_FULL, {
      level: stats.level,
      xp: stats.xp,
      xpToNext: this.getXpToNextLevel(stats.level),
      streak: stats.currentStreak,
      longestStreak: stats.longestStreak,
      totalWords: stats.totalWords,
      newWords: stats.newWords,
      learningWords: stats.learningWords,
      learnedWords: stats.learnedWords,
      masteredWords: stats.masteredWords,
      wordProgressBar,
      totalQuizzes: stats.totalQuizzes,
      totalAnswers: stats.totalAnswers,
      correctAnswers: stats.correctAnswers,
      accuracy: stats.accuracy,
      progressBar,
      todayQuizzes: stats.todayQuizzes,
      todayCorrect: stats.todayCorrect,
      todayXp: stats.todayXp,
    })
  }

  private createProgressBar(percentage: number): string {
    const filled = Math.round(percentage / 10)
    const empty = 10 - filled
    return '▓'.repeat(filled) + '░'.repeat(empty)
  }

  private createWordProgressBar(stats: UserStats): string {
    const total = stats.newWords + stats.learningWords + stats.learnedWords + stats.masteredWords
    if (total === 0) return '░░░░░░░░░░'

    const masteredPct = Math.round((stats.masteredWords / total) * 10)
    const learnedPct = Math.round((stats.learnedWords / total) * 10)
    const learningPct = Math.round((stats.learningWords / total) * 10)
    const remaining = 10 - masteredPct - learnedPct - learningPct

    return (
      '🟢'.repeat(masteredPct) +
      '🟡'.repeat(learnedPct) +
      '🟠'.repeat(learningPct) +
      '⚪'.repeat(remaining)
    )
  }

  private getXpToNextLevel(level: number): number {
    // Simple formula: each level requires level * 100 XP
    return level * 100
  }

  private async getUserWords(userId: string, page: number) {
    const skip = page * WORDS_PER_PAGE

    // Get words user has interacted with, sorted by knowledge (rating desc, then status)
    const [words, total] = await Promise.all([
      this.prisma.userWordProgress.findMany({
        where: { userId },
        include: {
          word: true,
        },
        orderBy: [
          { status: 'desc' }, // MASTERED > LEARNED > LEARNING > NEW
          { rating: 'desc' },
          { correctCount: 'desc' },
        ],
        skip,
        take: WORDS_PER_PAGE,
      }),
      this.prisma.userWordProgress.count({
        where: { userId },
      }),
    ])

    return {
      words,
      total,
      totalPages: Math.ceil(total / WORDS_PER_PAGE),
    }
  }

  private formatWordsListMessage(
    words: Array<{
      status: LearningStatus
      rating: number
      correctCount: number
      incorrectCount: number
      word: { georgian: string; russianPrimary: string }
    }>,
    page: number,
    total: number,
    totalPages: number,
  ): string {
    const lines = words.map((wp) => {
      const statusIcon = this.getStatusIcon(wp.status)
      const progressInfo = this.getProgressInfo(wp.status, wp.rating)
      return `${statusIcon} <b>${wp.word.georgian}</b> — ${wp.word.russianPrimary} ${progressInfo}`
    })

    return formatMessage(MESSAGES.WORDS_LIST, {
      page: page + 1,
      totalPages,
      total,
      words: lines.join('\n'),
    })
  }

  private getStatusIcon(status: LearningStatus): string {
    switch (status) {
      case LearningStatus.MASTERED:
        return '🟢'
      case LearningStatus.LEARNED:
        return '🟡'
      case LearningStatus.LEARNING:
        return '🟠'
      case LearningStatus.NEW:
      default:
        return '⚪'
    }
  }

  /**
   * Get progress info showing answers needed for next status
   * Thresholds: LEARNED at rating 4, MASTERED at rating 8
   */
  private getProgressInfo(status: LearningStatus, rating: number): string {
    switch (status) {
      case LearningStatus.MASTERED:
        return '✓'
      case LearningStatus.LEARNED: {
        const toMastered = 8 - rating
        return `+${toMastered}→🟢`
      }
      case LearningStatus.LEARNING: {
        const toLearned = 4 - rating
        return `+${toLearned}→🟡`
      }
      case LearningStatus.NEW:
      default:
        return '+4→🟡'
    }
  }

  private createWordsListKeyboard(page: number, totalPages: number) {
    const buttons = []

    // Pagination buttons
    const navButtons = []
    if (page > 0) {
      navButtons.push(Markup.button.callback('◀️', `words:list:${page - 1}`))
    }
    navButtons.push(Markup.button.callback(`${page + 1}/${totalPages}`, 'noop'))
    if (page < totalPages - 1) {
      navButtons.push(Markup.button.callback('▶️', `words:list:${page + 1}`))
    }

    if (navButtons.length > 0) {
      buttons.push(navButtons)
    }

    buttons.push([Markup.button.callback('« Назад к статистике', 'stats:show')])

    return Markup.inlineKeyboard(buttons)
  }
}
