import { Injectable, forwardRef, Inject } from '@nestjs/common'
import { Action, Command, Ctx, Hears, Update } from 'nestjs-telegraf'
import { Context, Markup } from 'telegraf'
import { PinoLogger } from 'nestjs-pino'
import { PrismaService } from '../../../common/prisma/prisma.service'
import { RedisService } from '../../../common/redis/redis.service'
import { QuizService } from '../../quiz/quiz.service'
import { CollectionsService } from '../../collections/collections.service'
import { WordEditHandler } from './word-edit.handler'
import { BulkImportHandler } from './bulk-import.handler'
import { TutorChatHandler } from './tutor-chat.handler'
import { TutorChatService } from '../services/tutor-chat.service'
import { MESSAGES, formatMessage } from '../constants/messages'
import { createQuizKeyboard } from '../keyboards/quiz.keyboard'
import { createMainKeyboard } from '../keyboards/main.keyboard'
import { createTutorChatKeyboard } from '../keyboards/tutor-chat.keyboard'
import { QuizSessionType } from '@prisma/client'
import { BulkImportSession, BulkImportState } from '../types/bulk-import.types'

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
    private readonly redis: RedisService,
    private readonly quizService: QuizService,
    private readonly collectionsService: CollectionsService,
    private readonly wordEditHandler: WordEditHandler,
    @Inject(forwardRef(() => BulkImportHandler))
    private readonly bulkImportHandler: BulkImportHandler,
    @Inject(forwardRef(() => TutorChatHandler))
    private readonly tutorChatHandler: TutorChatHandler,
    private readonly tutorChatService: TutorChatService,
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

      // Block quiz if in tutor chat mode
      const isInChat = await this.tutorChatService.isInChatMode(from.id.toString())
      if (isInChat) {
        const isCallback = ctx.callbackQuery !== undefined
        if (isCallback) {
          await ctx.answerCbQuery(MESSAGES.TUTOR_CHAT_QUIZ_BLOCKED)
        } else {
          await ctx.reply(MESSAGES.TUTOR_CHAT_QUIZ_BLOCKED, {
            ...createTutorChatKeyboard(),
          })
        }
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
          existingSession.currentQuestionIndex,
        )
        return
      }

      // Start new quiz with user's preferred word count
      const quiz = await this.quizService.startQuiz(user.id, {
        type: QuizSessionType.MANUAL,
        questionCount: user.quizWordsCount,
      })

      await ctx.reply(formatMessage(MESSAGES.QUIZ_STARTED, { total: quiz.totalQuestions }), {
        parse_mode: 'HTML',
      })

      // Send first question (index 0)
      await this.sendQuestion(ctx, quiz.currentQuestion, 1, quiz.totalQuestions, 0)

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

  @Action(/^quiz:answer:(\d+):(.+)$/)
  async onQuizAnswer(@Ctx() ctx: QuizContext) {
    try {
      const from = ctx.from
      if (!from) return

      // Extract question index and answer from callback data
      const callbackData = 'data' in ctx.callbackQuery! ? ctx.callbackQuery.data : ''
      const match = callbackData.match(/^quiz:answer:(\d+):(.+)$/)

      if (!match) {
        await ctx.answerCbQuery('Неверный формат ответа')
        return
      }

      const questionIndex = parseInt(match[1], 10)
      const answer = match[2]

      // Validate this is the current question
      const user = await this.prisma.user.findUnique({
        where: { telegramId: BigInt(from.id) },
      })

      if (!user) return

      const session = await this.quizService.getCurrentSession(user.id)

      this.logger.info(
        { questionIndex, currentIndex: session?.currentQuestionIndex, answer },
        'Quiz answer button clicked',
      )

      if (!session || session.currentQuestionIndex !== questionIndex) {
        this.logger.warn(
          { questionIndex, currentIndex: session?.currentQuestionIndex },
          'Stale quiz button clicked',
        )
        await ctx.answerCbQuery('Этот вопрос уже не актуален')
        return
      }

      await this.processAnswer(ctx, answer)
      await ctx.answerCbQuery()
    } catch (error) {
      this.logger.error({ error }, 'Failed to process quiz answer callback')
      await ctx.answerCbQuery(MESSAGES.ERROR_GENERIC)
    }
  }

  @Action(/^quiz:skip:(\d+)$/)
  async onSkipQuestion(@Ctx() ctx: QuizContext) {
    try {
      const from = ctx.from
      if (!from) return

      // Extract question index
      const callbackData = 'data' in ctx.callbackQuery! ? ctx.callbackQuery.data : ''
      const match = callbackData.match(/^quiz:skip:(\d+)$/)

      if (!match) {
        await ctx.answerCbQuery('Ошибка')
        return
      }

      const questionIndex = parseInt(match[1], 10)

      // Validate this is the current question
      const user = await this.prisma.user.findUnique({
        where: { telegramId: BigInt(from.id) },
      })

      if (!user) return

      const session = await this.quizService.getCurrentSession(user.id)

      if (!session || session.currentQuestionIndex !== questionIndex) {
        await ctx.answerCbQuery('Этот вопрос уже не актуален')
        return
      }

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

      this.logger.info({ telegramId: from.id }, 'QuizHandler received text message')

      // Check if user is in tutor chat mode - delegate to TutorChatHandler
      const handledByTutor = await this.tutorChatHandler.handleTextInChatMode(ctx)
      if (handledByTutor) return

      // Check if user is in bulk import mode - delegate to BulkImportHandler
      const bulkImportSession = await this.getBulkImportSession(from.id.toString())
      if (bulkImportSession?.state === BulkImportState.COLLECTING) {
        this.logger.info({ telegramId: from.id }, 'Delegating to BulkImportHandler')
        await this.bulkImportHandler.onText(ctx)
        return
      }

      // Check if user is editing a word - handle that first
      const handled = await this.wordEditHandler.handleEditInput(ctx)
      if (handled) return

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

    if (result.isCorrect) {
      await ctx.reply(feedbackMessage, { parse_mode: 'HTML' })
    } else {
      // Show edit button for incorrect answers
      await ctx.reply(feedbackMessage, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✏️ Редактировать слово', `word:edit:${result.wordId}`)],
        ]),
      })
    }

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
          newSession.currentQuestionIndex,
        )
      }
    }
  }

  private async sendQuestion(
    ctx: Context,
    question: { question: string; type: string; options: string[] },
    currentNum: number,
    total: number,
    questionIndex: number,
  ) {
    const questionText = formatMessage(MESSAGES.QUIZ_QUESTION, {
      current: currentNum,
      total,
      question: question.question,
    })

    await ctx.reply(questionText, {
      parse_mode: 'HTML',
      ...createQuizKeyboard(question.options, questionIndex),
    })
  }

  /**
   * Check if user has an active bulk import session
   */
  private async getBulkImportSession(telegramId: string): Promise<BulkImportSession | null> {
    const key = `bulk_import:${telegramId}`
    const data = await this.redis.get(key)
    this.logger.info({ key, hasData: !!data }, 'Checking bulk import session')
    if (!data) return null
    try {
      return JSON.parse(data) as BulkImportSession
    } catch {
      return null
    }
  }
}
