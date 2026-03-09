import { Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { QuizSessionType } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service'
import { QuizService } from '../quiz/quiz.service'
import { CollectionsService } from '../collections/collections.service'
import { MESSAGES, formatMessage } from '../telegram/constants/messages'
import {
  ChatUser,
  ChatResponse,
  ChatButton,
  ChatSession,
  ChatHistoryEntry,
} from './types/chat-bot.types'
import { nanoid } from 'nanoid'

@Injectable()
export class ChatBotService {
  private chatHistory: Map<string, ChatHistoryEntry[]> = new Map()

  constructor(
    private readonly prisma: PrismaService,
    private readonly quizService: QuizService,
    private readonly collectionsService: CollectionsService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ChatBotService.name)
  }

  /**
   * Handle incoming text message (command or free text)
   */
  async handleMessage(chatUser: ChatUser, text: string): Promise<ChatResponse> {
    this.addToHistory(chatUser.id, 'user', text)

    const trimmedText = text.trim()

    // Handle commands
    if (trimmedText.startsWith('/')) {
      const command = trimmedText.split(' ')[0].toLowerCase()
      return this.handleCommand(chatUser, command)
    }

    // Handle free text (quiz answer)
    return this.handleTextAnswer(chatUser, trimmedText)
  }

  /**
   * Handle callback (button click)
   */
  async handleCallback(chatUser: ChatUser, callbackData: string): Promise<ChatResponse> {
    this.addToHistory(chatUser.id, 'user', `[Button: ${callbackData}]`)

    // Quiz callbacks
    if (callbackData === 'quiz:start') {
      return this.startQuiz(chatUser)
    }

    if (callbackData === 'quiz:skip') {
      return this.handleTextAnswer(chatUser, '')
    }

    if (callbackData === 'quiz:stop') {
      return this.stopQuiz(chatUser)
    }

    if (callbackData.startsWith('quiz:answer:')) {
      const answer = callbackData.replace('quiz:answer:', '')
      return this.handleTextAnswer(chatUser, answer)
    }

    // Menu callbacks
    if (callbackData === 'menu:main') {
      return this.showMainMenu(chatUser)
    }

    if (callbackData === 'stats:show') {
      return this.createResponse(MESSAGES.PLACEHOLDER_STATS, this.createBackButton())
    }

    if (callbackData === 'streak:show') {
      return this.createResponse(MESSAGES.PLACEHOLDER_STREAK, this.createBackButton())
    }

    if (callbackData === 'achievements:show') {
      return this.createResponse(MESSAGES.PLACEHOLDER_ACHIEVEMENTS, this.createBackButton())
    }

    if (callbackData === 'collections:list') {
      return this.createResponse(MESSAGES.PLACEHOLDER_COLLECTIONS, this.createBackButton())
    }

    if (callbackData === 'settings:open') {
      return this.createResponse(
        '⚙️ Настройки доступны через команду /settings',
        this.createBackButton(),
      )
    }

    return this.createResponse('Unknown action')
  }

  /**
   * Get current session info
   */
  async getSession(chatUser: ChatUser): Promise<ChatSession | null> {
    const user = await this.prisma.user.findUnique({
      where: { telegramId: chatUser.telegramId },
    })

    if (!user) {
      return null
    }

    const quizSession = await this.quizService.getCurrentSession(user.id)

    return {
      userId: user.id,
      chatUserId: chatUser.id,
      telegramId: chatUser.telegramId,
      hasActiveQuiz: !!quizSession,
      quizSessionId: quizSession?.sessionId,
    }
  }

  /**
   * Get chat history for user
   */
  getHistory(chatUserId: string): ChatHistoryEntry[] {
    return this.chatHistory.get(chatUserId) || []
  }

  /**
   * Clear chat history for user
   */
  clearHistory(chatUserId: string): void {
    this.chatHistory.delete(chatUserId)
  }

  // Private methods

  private async handleCommand(chatUser: ChatUser, command: string): Promise<ChatResponse> {
    switch (command) {
      case '/start':
        return this.handleStart(chatUser)
      case '/quiz':
        return this.startQuiz(chatUser)
      case '/help':
        return this.createResponse(MESSAGES.HELP, this.createMainMenuButtons())
      case '/stats':
        return this.createResponse(MESSAGES.PLACEHOLDER_STATS, this.createBackButton())
      case '/streak':
        return this.createResponse(MESSAGES.PLACEHOLDER_STREAK, this.createBackButton())
      case '/achievements':
        return this.createResponse(MESSAGES.PLACEHOLDER_ACHIEVEMENTS, this.createBackButton())
      case '/collections':
        return this.createResponse(MESSAGES.PLACEHOLDER_COLLECTIONS, this.createBackButton())
      case '/settings':
        return this.createResponse(
          '⚙️ Настройки доступны в Telegram боте через /settings',
          this.createBackButton(),
        )
      default:
        return this.createResponse(`Unknown command: ${command}`)
    }
  }

  private async handleStart(chatUser: ChatUser): Promise<ChatResponse> {
    try {
      const user = await this.prisma.user.upsert({
        where: { telegramId: chatUser.telegramId },
        create: {
          telegramId: chatUser.telegramId,
          username: chatUser.username,
          firstName: chatUser.firstName,
          lastName: chatUser.lastName,
          languageCode: chatUser.languageCode || 'ru',
          lastActivityAt: new Date(),
        },
        update: {
          username: chatUser.username,
          firstName: chatUser.firstName,
          lastName: chatUser.lastName,
          lastActivityAt: new Date(),
        },
      })

      this.logger.info(
        { telegramId: chatUser.telegramId.toString(), userId: user.id },
        'User registered via chat bot',
      )

      const isReturning = user.xp > 0 || user.currentStreak > 0

      const message = isReturning
        ? formatMessage(MESSAGES.WELCOME_BACK, {
            firstName: chatUser.firstName || 'друг',
            streak: user.currentStreak,
            level: user.level,
            xp: user.xp,
          })
        : formatMessage(MESSAGES.WELCOME, {
            firstName: chatUser.firstName || 'друг',
          })

      return this.createResponse(message, this.createMainMenuButtons())
    } catch (error) {
      this.logger.error({ error }, 'Failed to handle /start')
      return this.createResponse(MESSAGES.ERROR_GENERIC)
    }
  }

  private async startQuiz(chatUser: ChatUser): Promise<ChatResponse> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { telegramId: chatUser.telegramId },
      })

      if (!user) {
        return this.createResponse(MESSAGES.ERROR_NOT_REGISTERED)
      }

      // Check if user has any active collections
      const userCollections = await this.collectionsService.getUserCollections(user.id)

      if (userCollections.length === 0) {
        try {
          await this.collectionsService.assignToUser(user.id, 'default-basic-collection')
          this.logger.info({ userId: user.id }, 'Auto-assigned default collection')
        } catch {
          return this.createResponse(MESSAGES.QUIZ_NO_WORDS)
        }
      }

      // Check for existing active session
      const existingSession = await this.quizService.getCurrentSession(user.id)

      if (existingSession) {
        return this.sendQuestion(
          existingSession.currentQuestion,
          existingSession.currentQuestionIndex + 1,
          existingSession.totalQuestions,
        )
      }

      // Start new quiz
      const quiz = await this.quizService.startQuiz(user.id, {
        type: QuizSessionType.MANUAL,
        questionCount: 5,
      })

      const startMessage = formatMessage(MESSAGES.QUIZ_STARTED, { total: quiz.totalQuestions })
      const questionResponse = this.sendQuestion(quiz.currentQuestion, 1, quiz.totalQuestions)

      return this.createResponse(
        `${startMessage}\n\n${questionResponse.text}`,
        questionResponse.buttons,
      )
    } catch (error) {
      this.logger.error({ error }, 'Failed to start quiz')

      const errorMessage = error instanceof Error ? error.message : MESSAGES.ERROR_GENERIC

      if (errorMessage.includes('No words available')) {
        return this.createResponse(MESSAGES.QUIZ_NO_WORDS)
      }

      return this.createResponse(MESSAGES.ERROR_GENERIC)
    }
  }

  private async handleTextAnswer(chatUser: ChatUser, answer: string): Promise<ChatResponse> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { telegramId: chatUser.telegramId },
      })

      if (!user) {
        return this.createResponse(MESSAGES.ERROR_NOT_REGISTERED)
      }

      const session = await this.quizService.getCurrentSession(user.id)

      if (!session) {
        return this.createResponse(MESSAGES.QUIZ_NO_ACTIVE)
      }

      const result = await this.quizService.submitAnswer(user.id, {
        sessionId: session.sessionId,
        userAnswer: answer,
      })

      const feedbackMessage = result.isCorrect
        ? formatMessage(MESSAGES.QUIZ_CORRECT, { answer: result.correctAnswer })
        : formatMessage(MESSAGES.QUIZ_INCORRECT, {
            correctAnswer: result.correctAnswer,
            userAnswer: answer || '(пропущено)',
          })

      if (result.sessionCompleted) {
        const completedSession = await this.prisma.quizSession.findUnique({
          where: { id: session.sessionId },
        })

        if (completedSession) {
          const resultsMessage = formatMessage(MESSAGES.QUIZ_COMPLETED, {
            correct: completedSession.correctAnswers,
            total: completedSession.totalQuestions,
            xp: completedSession.xpEarned,
          })

          return this.createResponse(
            `${feedbackMessage}\n\n${resultsMessage}`,
            this.createMainMenuButtons(),
          )
        }
      }

      if (result.nextQuestion) {
        const newSession = await this.quizService.getCurrentSession(user.id)
        if (newSession) {
          const questionResponse = this.sendQuestion(
            result.nextQuestion,
            newSession.currentQuestionIndex + 1,
            newSession.totalQuestions,
          )

          return this.createResponse(
            `${feedbackMessage}\n\n${questionResponse.text}`,
            questionResponse.buttons,
          )
        }
      }

      return this.createResponse(feedbackMessage)
    } catch (error) {
      this.logger.error({ error }, 'Failed to process answer')
      return this.createResponse(MESSAGES.ERROR_GENERIC)
    }
  }

  private async stopQuiz(chatUser: ChatUser): Promise<ChatResponse> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { telegramId: chatUser.telegramId },
      })

      if (!user) {
        return this.createResponse(MESSAGES.ERROR_NOT_REGISTERED)
      }

      const session = await this.quizService.getCurrentSession(user.id)

      if (session) {
        await this.prisma.quizSession.update({
          where: { id: session.sessionId },
          data: { status: 'ABANDONED' },
        })
      }

      return this.createResponse(MESSAGES.QUIZ_STOPPED, this.createMainMenuButtons())
    } catch (error) {
      this.logger.error({ error }, 'Failed to stop quiz')
      return this.createResponse(MESSAGES.ERROR_GENERIC)
    }
  }

  private async showMainMenu(chatUser: ChatUser): Promise<ChatResponse> {
    const user = await this.prisma.user.findUnique({
      where: { telegramId: chatUser.telegramId },
    })

    if (!user) {
      return this.handleStart(chatUser)
    }

    const message = formatMessage(MESSAGES.WELCOME, {
      firstName: chatUser.firstName || 'друг',
    })

    return this.createResponse(message, this.createMainMenuButtons())
  }

  private sendQuestion(
    question: { question: string; type: string; options: string[] },
    currentNum: number,
    total: number,
  ): ChatResponse {
    const questionText = formatMessage(MESSAGES.QUIZ_QUESTION, {
      current: currentNum,
      total,
      question: question.question,
    })

    const buttons: ChatButton[][] = []

    if (question.options && question.options.length > 0) {
      for (const option of question.options) {
        buttons.push([{ text: option, callbackData: `quiz:answer:${option}` }])
      }
    }

    buttons.push([
      { text: '⏭ Пропустить', callbackData: 'quiz:skip' },
      { text: '⏹ Остановить', callbackData: 'quiz:stop' },
    ])

    return this.createResponse(questionText, buttons)
  }

  private createMainMenuButtons(): ChatButton[][] {
    return [
      [{ text: MESSAGES.BUTTON_START_QUIZ, callbackData: 'quiz:start' }],
      [
        { text: MESSAGES.BUTTON_MY_STATS, callbackData: 'stats:show' },
        { text: MESSAGES.BUTTON_MY_STREAK, callbackData: 'streak:show' },
      ],
      [
        { text: MESSAGES.BUTTON_ACHIEVEMENTS, callbackData: 'achievements:show' },
        { text: MESSAGES.BUTTON_COLLECTIONS, callbackData: 'collections:list' },
      ],
      [{ text: MESSAGES.BUTTON_SETTINGS, callbackData: 'settings:open' }],
    ]
  }

  private createBackButton(): ChatButton[][] {
    return [[{ text: MESSAGES.BUTTON_BACK, callbackData: 'menu:main' }]]
  }

  private createResponse(text: string, buttons?: ChatButton[][]): ChatResponse {
    const response: ChatResponse = {
      text,
      parseMode: 'HTML',
      buttons,
    }

    // Add to history
    if (this.chatHistory.size > 0) {
      const lastUserId = Array.from(this.chatHistory.keys()).pop()
      if (lastUserId) {
        this.addToHistory(lastUserId, 'bot', text, buttons)
      }
    }

    return response
  }

  private addToHistory(
    chatUserId: string,
    role: 'user' | 'bot',
    text: string,
    buttons?: ChatButton[][],
  ): void {
    if (!this.chatHistory.has(chatUserId)) {
      this.chatHistory.set(chatUserId, [])
    }

    this.chatHistory.get(chatUserId)!.push({
      id: nanoid(),
      role,
      text,
      buttons,
      timestamp: new Date(),
    })
  }
}
