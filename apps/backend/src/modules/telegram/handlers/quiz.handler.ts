import { Injectable } from '@nestjs/common'
import { Action, Command, Ctx, Hears, Update } from 'nestjs-telegraf'
import { Context } from 'telegraf'
import { PinoLogger } from 'nestjs-pino'
import { PrismaService } from '../../../common/prisma/prisma.service'
import { QuizService } from '../../quiz/quiz.service'
import { CollectionsService } from '../../collections/collections.service'
import { MESSAGES, formatMessage } from '../constants/messages'
import { createQuizKeyboard } from '../keyboards/quiz.keyboard'
import { createMainKeyboard } from '../keyboards/main.keyboard'
import { QuizSessionType } from '@prisma/client'

interface QuizContext extends Context {
  session?: {
    awaitingAnswer?: boolean
    currentSessionId?: string
  }
}

@Update()
@Injectable()
export class QuizHandler {
  constructor(
    private readonly logger: PinoLogger,
    private readonly prisma: PrismaService,
    private readonly quizService: QuizService,
    private readonly collectionsService: CollectionsService,
  ) {
    this.logger.setContext(QuizHandler.name)
  }

  @Command('quiz')
  @Action('quiz:start')
  async onStartQuiz(@Ctx() ctx: QuizContext) {
    try {
      const from = ctx.from
      if (!from) {
        await ctx.reply(MESSAGES.ERROR_NOT_REGISTERED)
        return
      }

      // Find user in database
      const user = await this.prisma.user.findUnique({
        where: { telegramId: BigInt(from.id) },
      })

      if (!user) {
        await ctx.reply(MESSAGES.ERROR_NOT_REGISTERED)
        return
      }

      // Check if user has any active collections
      const userCollections = await this.collectionsService.getUserCollections(user.id)

      if (userCollections.length === 0) {
        // Auto-assign default collection
        try {
          await this.collectionsService.assignToUser(user.id, 'default-basic-collection')
          this.logger.info({ userId: user.id }, 'Auto-assigned default collection')
        } catch {
          await ctx.reply(MESSAGES.QUIZ_NO_WORDS, { parse_mode: 'HTML' })
          return
        }
      }

      // Check for existing active session
      const existingSession = await this.quizService.getCurrentSession(user.id)

      if (existingSession) {
        // Resume existing session
        await this.sendQuestion(
          ctx,
          existingSession.currentQuestion,
          existingSession.currentQuestionIndex + 1,
          existingSession.totalQuestions,
        )
        return
      }

      // Start new quiz
      const quiz = await this.quizService.startQuiz(user.id, {
        type: QuizSessionType.MANUAL,
        questionCount: 5,
      })

      await ctx.reply(formatMessage(MESSAGES.QUIZ_STARTED, { total: quiz.totalQuestions }), {
        parse_mode: 'HTML',
      })

      // Send first question
      await this.sendQuestion(ctx, quiz.currentQuestion, 1, quiz.totalQuestions)

      // Answer callback query if triggered by button
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery()
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to start quiz')

      const errorMessage = error instanceof Error ? error.message : MESSAGES.ERROR_GENERIC

      if (errorMessage.includes('No words available')) {
        await ctx.reply(MESSAGES.QUIZ_NO_WORDS, { parse_mode: 'HTML' })
      } else {
        await ctx.reply(MESSAGES.ERROR_GENERIC, { parse_mode: 'HTML' })
      }

      if (ctx.callbackQuery) {
        await ctx.answerCbQuery()
      }
    }
  }

  @Action(/^quiz:answer:(.+)$/)
  async onQuizAnswer(@Ctx() ctx: QuizContext) {
    try {
      const from = ctx.from
      if (!from) return

      // Extract answer from callback data
      const callbackData = 'data' in ctx.callbackQuery! ? ctx.callbackQuery.data : ''
      const answer = callbackData.replace('quiz:answer:', '')

      await this.processAnswer(ctx, answer)
      await ctx.answerCbQuery()
    } catch (error) {
      this.logger.error({ error }, 'Failed to process quiz answer callback')
      await ctx.answerCbQuery(MESSAGES.ERROR_GENERIC)
    }
  }

  @Action('quiz:skip')
  async onSkipQuestion(@Ctx() ctx: QuizContext) {
    try {
      await this.processAnswer(ctx, '')
      await ctx.answerCbQuery('Пропущено')
    } catch (error) {
      this.logger.error({ error }, 'Failed to skip question')
      await ctx.answerCbQuery(MESSAGES.ERROR_GENERIC)
    }
  }

  @Action('quiz:stop')
  async onStopQuiz(@Ctx() ctx: QuizContext) {
    try {
      const from = ctx.from
      if (!from) return

      const user = await this.prisma.user.findUnique({
        where: { telegramId: BigInt(from.id) },
      })

      if (!user) return

      // Mark current session as abandoned
      const session = await this.quizService.getCurrentSession(user.id)
      if (session) {
        await this.prisma.quizSession.update({
          where: { id: session.sessionId },
          data: { status: 'ABANDONED' },
        })
      }

      await ctx.editMessageText(MESSAGES.QUIZ_STOPPED, {
        parse_mode: 'HTML',
        ...createMainKeyboard(),
      })
      await ctx.answerCbQuery('Квиз остановлен')
    } catch (error) {
      this.logger.error({ error }, 'Failed to stop quiz')
      await ctx.answerCbQuery(MESSAGES.ERROR_GENERIC)
    }
  }

  /**
   * Handle text messages as quiz answers
   */
  @Hears(/^[^/].*$/)
  async onTextMessage(@Ctx() ctx: QuizContext) {
    try {
      const from = ctx.from
      if (!from || !('text' in ctx.message!)) return

      const user = await this.prisma.user.findUnique({
        where: { telegramId: BigInt(from.id) },
      })

      if (!user) return

      // Check if there's an active quiz session
      const session = await this.quizService.getCurrentSession(user.id)

      if (!session) {
        // No active quiz - ignore message
        return
      }

      const answer = ctx.message.text.trim()
      await this.processAnswer(ctx, answer)
    } catch (error) {
      this.logger.error({ error }, 'Failed to process text answer')
    }
  }

  private async processAnswer(ctx: QuizContext, answer: string) {
    const from = ctx.from
    if (!from) return

    const user = await this.prisma.user.findUnique({
      where: { telegramId: BigInt(from.id) },
    })

    if (!user) return

    const session = await this.quizService.getCurrentSession(user.id)
    if (!session) {
      await ctx.reply(MESSAGES.QUIZ_NO_ACTIVE, { parse_mode: 'HTML' })
      return
    }

    // Submit answer
    const result = await this.quizService.submitAnswer(user.id, {
      sessionId: session.sessionId,
      userAnswer: answer,
    })

    // Show feedback
    const feedbackMessage = result.isCorrect
      ? formatMessage(MESSAGES.QUIZ_CORRECT, { answer: result.correctAnswer })
      : formatMessage(MESSAGES.QUIZ_INCORRECT, {
          correctAnswer: result.correctAnswer,
          userAnswer: answer || '(пропущено)',
        })

    await ctx.reply(feedbackMessage, { parse_mode: 'HTML' })

    if (result.sessionCompleted) {
      // Quiz completed - show results
      const completedSession = await this.prisma.quizSession.findUnique({
        where: { id: session.sessionId },
      })

      if (completedSession) {
        const resultsMessage = formatMessage(MESSAGES.QUIZ_COMPLETED, {
          correct: completedSession.correctAnswers,
          total: completedSession.totalQuestions,
          xp: completedSession.xpEarned,
        })

        await ctx.reply(resultsMessage, {
          parse_mode: 'HTML',
          ...createMainKeyboard(),
        })
      }
    } else if (result.nextQuestion) {
      // Send next question
      const newSession = await this.quizService.getCurrentSession(user.id)
      if (newSession) {
        await this.sendQuestion(
          ctx,
          result.nextQuestion,
          newSession.currentQuestionIndex + 1,
          newSession.totalQuestions,
        )
      }
    }
  }

  private async sendQuestion(
    ctx: Context,
    question: { question: string; type: string; options: string[] },
    currentNum: number,
    total: number,
  ) {
    const questionText = formatMessage(MESSAGES.QUIZ_QUESTION, {
      current: currentNum,
      total,
      question: question.question,
    })

    await ctx.reply(questionText, {
      parse_mode: 'HTML',
      ...createQuizKeyboard(question.options),
    })
  }
}
