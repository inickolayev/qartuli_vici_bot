import { Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { QuizSessionType } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service'
import { QuizService } from '../quiz/quiz.service'
import { CollectionsService } from '../collections/collections.service'
import { SettingsService } from '../telegram/services/settings.service'
import { MESSAGES, formatMessage } from '../telegram/constants/messages'
import {
  createSettingsKeyboardLayout,
  createHoursKeyboardLayout,
  createTimezoneKeyboardLayout,
} from '../telegram/keyboards/settings.keyboard'
import {
  createMainKeyboardLayout,
  createBackToMenuKeyboardLayout,
} from '../telegram/keyboards/main.keyboard'
import { KeyboardLayout } from '../telegram/keyboards/types'
import { ChatUser, ChatResponse, ChatSession, ChatHistoryEntry } from './types/chat-bot.types'
import { nanoid } from 'nanoid'

@Injectable()
export class ChatBotService {
  private chatHistory: Map<string, ChatHistoryEntry[]> = new Map()

  constructor(
    private readonly prisma: PrismaService,
    private readonly quizService: QuizService,
    private readonly collectionsService: CollectionsService,
    private readonly settingsService: SettingsService,
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

    if (callbackData === 'noop') {
      return this.createResponse('') // No-op
    }

    if (callbackData === 'stats:show') {
      return this.createResponse(MESSAGES.PLACEHOLDER_STATS, createBackToMenuKeyboardLayout())
    }

    if (callbackData === 'streak:show') {
      return this.createResponse(MESSAGES.PLACEHOLDER_STREAK, createBackToMenuKeyboardLayout())
    }

    if (callbackData === 'achievements:show') {
      return this.createResponse(
        MESSAGES.PLACEHOLDER_ACHIEVEMENTS,
        createBackToMenuKeyboardLayout(),
      )
    }

    if (callbackData === 'collections:list') {
      return this.createResponse(MESSAGES.PLACEHOLDER_COLLECTIONS, createBackToMenuKeyboardLayout())
    }

    // Settings callbacks
    if (callbackData === 'settings:open') {
      return this.showSettings(chatUser)
    }

    // Settings: quiz words count
    if (callbackData.startsWith('settings:quiz:')) {
      const count = parseInt(callbackData.replace('settings:quiz:', ''), 10)
      if ([5, 10, 15].includes(count)) {
        return this.updateQuizWordsCount(chatUser, count)
      }
    }

    // Settings: words per day
    if (callbackData.startsWith('settings:words:')) {
      const count = parseInt(callbackData.replace('settings:words:', ''), 10)
      if ([10, 20, 30].includes(count)) {
        return this.updateWordsPerDay(chatUser, count)
      }
    }

    // Settings: push interval
    if (callbackData.startsWith('settings:interval:')) {
      const interval = parseInt(callbackData.replace('settings:interval:', ''), 10)
      if ([0, 5, 10, 60].includes(interval)) {
        return this.updatePushInterval(chatUser, interval)
      }
    }

    // Settings: timezone menu
    if (callbackData === 'settings:timezone:menu') {
      return this.showTimezoneMenu(chatUser)
    }

    // Settings: set timezone
    if (
      callbackData.startsWith('settings:timezone:') &&
      callbackData !== 'settings:timezone:menu'
    ) {
      const timezone = callbackData.replace('settings:timezone:', '')
      return this.updateTimezone(chatUser, timezone)
    }

    // Settings: hours menu
    if (callbackData === 'settings:hours:menu') {
      return this.showHoursMenu(chatUser)
    }

    // Settings: toggle hour
    if (callbackData.startsWith('settings:hours:toggle:')) {
      const hour = parseInt(callbackData.replace('settings:hours:toggle:', ''), 10)
      return this.toggleHour(chatUser, hour)
    }

    // Settings: start hour
    if (callbackData.startsWith('settings:hours:start:')) {
      const hour = parseInt(callbackData.replace('settings:hours:start:', ''), 10)
      return this.updateStartHour(chatUser, hour)
    }

    // Settings: end hour
    if (callbackData.startsWith('settings:hours:end:')) {
      const hour = parseInt(callbackData.replace('settings:hours:end:', ''), 10)
      return this.updateEndHour(chatUser, hour)
    }

    // Settings: pause/resume
    if (callbackData === 'settings:pause') {
      return this.pauseLearning(chatUser)
    }

    if (callbackData === 'settings:resume') {
      return this.resumeLearning(chatUser)
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
        return this.createResponse(MESSAGES.HELP, createMainKeyboardLayout())
      case '/stats':
        return this.createResponse(MESSAGES.PLACEHOLDER_STATS, createBackToMenuKeyboardLayout())
      case '/streak':
        return this.createResponse(MESSAGES.PLACEHOLDER_STREAK, createBackToMenuKeyboardLayout())
      case '/achievements':
        return this.createResponse(
          MESSAGES.PLACEHOLDER_ACHIEVEMENTS,
          createBackToMenuKeyboardLayout(),
        )
      case '/collections':
        return this.createResponse(
          MESSAGES.PLACEHOLDER_COLLECTIONS,
          createBackToMenuKeyboardLayout(),
        )
      case '/settings':
        return this.showSettings(chatUser)
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

      return this.createResponse(message, createMainKeyboardLayout())
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

      // Start new quiz with user's preferred word count
      const quiz = await this.quizService.startQuiz(user.id, {
        type: QuizSessionType.MANUAL,
        questionCount: user.quizWordsCount,
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
            createMainKeyboardLayout(),
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

      return this.createResponse(MESSAGES.QUIZ_STOPPED, createMainKeyboardLayout())
    } catch (error) {
      this.logger.error({ error }, 'Failed to stop quiz')
      return this.createResponse(MESSAGES.ERROR_GENERIC)
    }
  }

  // Settings methods - using shared SettingsService

  private async showSettings(chatUser: ChatUser): Promise<ChatResponse> {
    const result = await this.settingsService.getSettings(chatUser.telegramId)

    if (!result) {
      return this.createResponse(MESSAGES.ERROR_NOT_REGISTERED)
    }

    return this.createResponse(result.message, createSettingsKeyboardLayout(result.user))
  }

  private async updateQuizWordsCount(chatUser: ChatUser, count: number): Promise<ChatResponse> {
    const result = await this.settingsService.updateQuizWordsCount(chatUser.telegramId, count)
    return this.createResponse(result.message, createSettingsKeyboardLayout(result.user))
  }

  private async updateWordsPerDay(chatUser: ChatUser, count: number): Promise<ChatResponse> {
    const result = await this.settingsService.updateWordsPerDay(chatUser.telegramId, count)
    return this.createResponse(result.message, createSettingsKeyboardLayout(result.user))
  }

  private async updatePushInterval(chatUser: ChatUser, interval: number): Promise<ChatResponse> {
    const result = await this.settingsService.updatePushInterval(chatUser.telegramId, interval)
    return this.createResponse(result.message, createSettingsKeyboardLayout(result.user))
  }

  private async showTimezoneMenu(chatUser: ChatUser): Promise<ChatResponse> {
    const result = await this.settingsService.getSettings(chatUser.telegramId)

    if (!result) {
      return this.createResponse(MESSAGES.ERROR_NOT_REGISTERED)
    }

    return this.createResponse(
      MESSAGES.SETTINGS_TIMEZONE_SELECT,
      createTimezoneKeyboardLayout(result.user.timezone),
    )
  }

  private async updateTimezone(chatUser: ChatUser, timezone: string): Promise<ChatResponse> {
    const result = await this.settingsService.updateTimezone(chatUser.telegramId, timezone)
    return this.createResponse(result.message, createSettingsKeyboardLayout(result.user))
  }

  private async showHoursMenu(chatUser: ChatUser): Promise<ChatResponse> {
    const result = await this.settingsService.getSettings(chatUser.telegramId)

    if (!result) {
      return this.createResponse(MESSAGES.ERROR_NOT_REGISTERED)
    }

    const message =
      result.user.pushIntervalMinutes === 0
        ? MESSAGES.SETTINGS_HOURS_SELECT
        : formatMessage(MESSAGES.SETTINGS_HOURS_RANGE, {
            start: result.user.activeHoursStart,
            end: result.user.activeHoursEnd,
          })

    return this.createResponse(message, createHoursKeyboardLayout(result.user))
  }

  private async toggleHour(chatUser: ChatUser, hour: number): Promise<ChatResponse> {
    const currentResult = await this.settingsService.getSettings(chatUser.telegramId)

    if (!currentResult) {
      return this.createResponse(MESSAGES.ERROR_NOT_REGISTERED)
    }

    let newHours: number[]
    if (currentResult.user.preferredHours.includes(hour)) {
      // Remove hour (but keep at least one)
      if (currentResult.user.preferredHours.length <= 1) {
        return this.createResponse(
          'Нужен хотя бы один час',
          createHoursKeyboardLayout(currentResult.user),
        )
      }
      newHours = currentResult.user.preferredHours.filter((h) => h !== hour)
    } else {
      // Add hour
      newHours = [...currentResult.user.preferredHours, hour].sort((a, b) => a - b)
    }

    const result = await this.settingsService.updatePreferredHours(chatUser.telegramId, newHours)
    return this.createResponse(
      MESSAGES.SETTINGS_HOURS_SELECT,
      createHoursKeyboardLayout(result.user),
    )
  }

  private async updateStartHour(chatUser: ChatUser, hour: number): Promise<ChatResponse> {
    const result = await this.settingsService.updateActiveHoursStart(chatUser.telegramId, hour)

    const message = formatMessage(MESSAGES.SETTINGS_HOURS_RANGE, {
      start: result.user.activeHoursStart,
      end: result.user.activeHoursEnd,
    })

    return this.createResponse(message, createHoursKeyboardLayout(result.user))
  }

  private async updateEndHour(chatUser: ChatUser, hour: number): Promise<ChatResponse> {
    const result = await this.settingsService.updateActiveHoursEnd(chatUser.telegramId, hour)

    const message = formatMessage(MESSAGES.SETTINGS_HOURS_RANGE, {
      start: result.user.activeHoursStart,
      end: result.user.activeHoursEnd,
    })

    return this.createResponse(message, createHoursKeyboardLayout(result.user))
  }

  private async pauseLearning(chatUser: ChatUser): Promise<ChatResponse> {
    const result = await this.settingsService.pauseLearning(chatUser.telegramId)
    return this.createResponse(result.message, createSettingsKeyboardLayout(result.user))
  }

  private async resumeLearning(chatUser: ChatUser): Promise<ChatResponse> {
    const result = await this.settingsService.resumeLearning(chatUser.telegramId)
    return this.createResponse(result.message, createSettingsKeyboardLayout(result.user))
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

    return this.createResponse(message, createMainKeyboardLayout())
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

    const buttons: KeyboardLayout = []

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

  private createResponse(text: string, buttons?: KeyboardLayout): ChatResponse {
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
    buttons?: KeyboardLayout,
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
