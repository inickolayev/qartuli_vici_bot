import { Test, TestingModule } from '@nestjs/testing'
import { ChatBotService } from '../chat-bot.service'
import { PrismaService } from '../../../common/prisma/prisma.service'
import { QuizService } from '../../quiz/quiz.service'
import { CollectionsService } from '../../collections/collections.service'
import { PinoLogger } from 'nestjs-pino'
import { ChatUser } from '../types/chat-bot.types'

describe('ChatBotService', () => {
  let service: ChatBotService

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    quizSession: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  }

  const mockQuizService = {
    startQuiz: jest.fn(),
    submitAnswer: jest.fn(),
    getCurrentSession: jest.fn(),
  }

  const mockCollectionsService = {
    getUserCollections: jest.fn(),
    assignToUser: jest.fn(),
  }

  const testUser: ChatUser = {
    id: 'test-user-1',
    telegramId: BigInt(123456789),
    firstName: 'Test',
    lastName: 'User',
    username: 'testuser',
    languageCode: 'ru',
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatBotService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: QuizService, useValue: mockQuizService },
        { provide: CollectionsService, useValue: mockCollectionsService },
        { provide: PinoLogger, useValue: mockLogger },
      ],
    }).compile()

    service = module.get<ChatBotService>(ChatBotService)

    // Reset all mocks
    jest.clearAllMocks()
  })

  describe('handleMessage', () => {
    describe('/start command', () => {
      it('should register new user and return welcome message', async () => {
        const mockUser = {
          id: 'user-id-1',
          telegramId: testUser.telegramId,
          firstName: 'Test',
          xp: 0,
          currentStreak: 0,
          level: 1,
        }

        mockPrismaService.user.upsert.mockResolvedValue(mockUser)

        const response = await service.handleMessage(testUser, '/start')

        expect(response.text).toContain('Добро пожаловать')
        expect(response.text).toContain('Test')
        expect(response.buttons).toBeDefined()
        expect(response.buttons!.length).toBeGreaterThan(0)
        expect(mockPrismaService.user.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { telegramId: testUser.telegramId },
          }),
        )
      })

      it('should return welcome back message for returning user', async () => {
        const returningUser = {
          id: 'user-id-1',
          telegramId: testUser.telegramId,
          firstName: 'Test',
          xp: 100,
          currentStreak: 5,
          level: 2,
        }

        mockPrismaService.user.upsert.mockResolvedValue(returningUser)

        const response = await service.handleMessage(testUser, '/start')

        expect(response.text).toContain('С возвращением')
        expect(response.text).toContain('5 дней')
        expect(response.buttons).toBeDefined()
      })
    })

    describe('/help command', () => {
      it('should return help message with commands list', async () => {
        const response = await service.handleMessage(testUser, '/help')

        expect(response.text).toContain('/start')
        expect(response.text).toContain('/quiz')
        expect(response.text).toContain('/stats')
        expect(response.buttons).toBeDefined()
      })
    })

    describe('/quiz command', () => {
      it('should start quiz when user has collections', async () => {
        const mockUser = { id: 'user-id-1', telegramId: testUser.telegramId }
        const mockQuiz = {
          sessionId: 'session-1',
          totalQuestions: 5,
          currentQuestion: {
            question: 'Как переводится "გამარჯობა"?',
            type: 'KA_TO_RU',
            options: [],
          },
        }

        mockPrismaService.user.findUnique.mockResolvedValue(mockUser)
        mockCollectionsService.getUserCollections.mockResolvedValue([{ id: 'col-1' }])
        mockQuizService.getCurrentSession.mockResolvedValue(null)
        mockQuizService.startQuiz.mockResolvedValue(mockQuiz)

        const response = await service.handleMessage(testUser, '/quiz')

        expect(response.text).toContain('Квиз начался')
        expect(response.text).toContain('გამარჯობა')
        expect(response.buttons).toBeDefined()
        // Should have skip and stop buttons
        const allButtons = response.buttons!.flat()
        expect(allButtons.some((b) => b.text.includes('Пропустить'))).toBe(true)
        expect(allButtons.some((b) => b.text.includes('Остановить'))).toBe(true)
      })

      it('should return error when user is not registered', async () => {
        mockPrismaService.user.findUnique.mockResolvedValue(null)

        const response = await service.handleMessage(testUser, '/quiz')

        expect(response.text).toContain('нажми /start')
      })

      it('should resume existing quiz session', async () => {
        const mockUser = { id: 'user-id-1', telegramId: testUser.telegramId }
        const existingSession = {
          sessionId: 'session-1',
          totalQuestions: 5,
          currentQuestionIndex: 2,
          currentQuestion: {
            question: 'Как переводится "მადლობა"?',
            type: 'KA_TO_RU',
            options: [],
          },
        }

        mockPrismaService.user.findUnique.mockResolvedValue(mockUser)
        mockCollectionsService.getUserCollections.mockResolvedValue([{ id: 'col-1' }])
        mockQuizService.getCurrentSession.mockResolvedValue(existingSession)

        const response = await service.handleMessage(testUser, '/quiz')

        expect(response.text).toContain('მადლობა')
        expect(response.text).toContain('3/5') // Question 3 of 5
        expect(mockQuizService.startQuiz).not.toHaveBeenCalled()
      })
    })

    describe('text answers', () => {
      it('should submit answer when quiz is active', async () => {
        const mockUser = { id: 'user-id-1', telegramId: testUser.telegramId }
        const session = {
          sessionId: 'session-1',
          totalQuestions: 5,
          currentQuestionIndex: 0,
        }
        const answerResult = {
          isCorrect: true,
          correctAnswer: 'привет',
          isLastQuestion: false,
          nextQuestion: {
            question: 'Next question',
            type: 'KA_TO_RU',
            options: [],
          },
        }

        mockPrismaService.user.findUnique.mockResolvedValue(mockUser)
        mockQuizService.getCurrentSession
          .mockResolvedValueOnce(session)
          .mockResolvedValueOnce({ ...session, currentQuestionIndex: 1 })
        mockQuizService.submitAnswer.mockResolvedValue(answerResult)

        const response = await service.handleMessage(testUser, 'привет')

        expect(response.text).toContain('Правильно')
        expect(mockQuizService.submitAnswer).toHaveBeenCalledWith('user-id-1', {
          sessionId: 'session-1',
          userAnswer: 'привет',
        })
      })

      it('should show incorrect feedback', async () => {
        const mockUser = { id: 'user-id-1', telegramId: testUser.telegramId }
        const session = { sessionId: 'session-1' }
        const answerResult = {
          isCorrect: false,
          correctAnswer: 'привет',
          isLastQuestion: false,
          nextQuestion: { question: 'Next', type: 'KA_TO_RU', options: [] },
        }

        mockPrismaService.user.findUnique.mockResolvedValue(mockUser)
        mockQuizService.getCurrentSession
          .mockResolvedValueOnce(session)
          .mockResolvedValueOnce({ ...session, currentQuestionIndex: 1 })
        mockQuizService.submitAnswer.mockResolvedValue(answerResult)

        const response = await service.handleMessage(testUser, 'wrong')

        expect(response.text).toContain('Неправильно')
        expect(response.text).toContain('привет')
      })

      it('should return no active quiz message when no session', async () => {
        const mockUser = { id: 'user-id-1', telegramId: testUser.telegramId }

        mockPrismaService.user.findUnique.mockResolvedValue(mockUser)
        mockQuizService.getCurrentSession.mockResolvedValue(null)

        const response = await service.handleMessage(testUser, 'some text')

        expect(response.text).toContain('Нет активного квиза')
      })
    })
  })

  describe('handleCallback', () => {
    describe('quiz:start', () => {
      it('should start quiz via callback', async () => {
        const mockUser = { id: 'user-id-1', telegramId: testUser.telegramId }
        const mockQuiz = {
          sessionId: 'session-1',
          totalQuestions: 5,
          currentQuestion: { question: 'Test?', type: 'KA_TO_RU', options: [] },
        }

        mockPrismaService.user.findUnique.mockResolvedValue(mockUser)
        mockCollectionsService.getUserCollections.mockResolvedValue([{ id: 'col-1' }])
        mockQuizService.getCurrentSession.mockResolvedValue(null)
        mockQuizService.startQuiz.mockResolvedValue(mockQuiz)

        const response = await service.handleCallback(testUser, 'quiz:start')

        expect(response.text).toContain('Квиз начался')
      })
    })

    describe('quiz:skip', () => {
      it('should skip question (submit empty answer)', async () => {
        const mockUser = { id: 'user-id-1', telegramId: testUser.telegramId }
        const session = { sessionId: 'session-1' }
        const answerResult = {
          isCorrect: false,
          correctAnswer: 'привет',
          isLastQuestion: false,
          nextQuestion: { question: 'Next', type: 'KA_TO_RU', options: [] },
        }

        mockPrismaService.user.findUnique.mockResolvedValue(mockUser)
        mockQuizService.getCurrentSession
          .mockResolvedValueOnce(session)
          .mockResolvedValueOnce({ ...session, currentQuestionIndex: 1 })
        mockQuizService.submitAnswer.mockResolvedValue(answerResult)

        await service.handleCallback(testUser, 'quiz:skip')

        expect(mockQuizService.submitAnswer).toHaveBeenCalledWith('user-id-1', {
          sessionId: 'session-1',
          userAnswer: '',
        })
      })
    })

    describe('quiz:stop', () => {
      it('should stop active quiz', async () => {
        const mockUser = { id: 'user-id-1', telegramId: testUser.telegramId }
        const session = { sessionId: 'session-1' }

        mockPrismaService.user.findUnique.mockResolvedValue(mockUser)
        mockQuizService.getCurrentSession.mockResolvedValue(session)
        mockPrismaService.quizSession.update.mockResolvedValue({})

        const response = await service.handleCallback(testUser, 'quiz:stop')

        expect(response.text).toContain('Квиз остановлен')
        expect(mockPrismaService.quizSession.update).toHaveBeenCalledWith({
          where: { id: 'session-1' },
          data: { status: 'ABANDONED' },
        })
      })
    })

    describe('menu callbacks', () => {
      it('should return stats placeholder', async () => {
        const response = await service.handleCallback(testUser, 'stats:show')
        expect(response.text).toContain('Статистика')
      })

      it('should return streak placeholder', async () => {
        const response = await service.handleCallback(testUser, 'streak:show')
        expect(response.text).toContain('Серия')
      })

      it('should return achievements placeholder', async () => {
        const response = await service.handleCallback(testUser, 'achievements:show')
        expect(response.text).toContain('Достижения')
      })
    })
  })

  describe('getSession', () => {
    it('should return null when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null)

      const session = await service.getSession(testUser)

      expect(session).toBeNull()
    })

    it('should return session info with active quiz', async () => {
      const mockUser = { id: 'user-id-1', telegramId: testUser.telegramId }
      const quizSession = { sessionId: 'session-1' }

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser)
      mockQuizService.getCurrentSession.mockResolvedValue(quizSession)

      const session = await service.getSession(testUser)

      expect(session).toEqual({
        userId: 'user-id-1',
        chatUserId: testUser.id,
        telegramId: testUser.telegramId,
        hasActiveQuiz: true,
        quizSessionId: 'session-1',
      })
    })
  })

  describe('history management', () => {
    it('should track message history', async () => {
      mockPrismaService.user.upsert.mockResolvedValue({
        id: 'user-id-1',
        xp: 0,
        currentStreak: 0,
        level: 1,
      })

      await service.handleMessage(testUser, '/start')

      const history = service.getHistory(testUser.id)
      expect(history.length).toBeGreaterThan(0)
      expect(history[0].role).toBe('user')
      expect(history[0].text).toBe('/start')
    })

    it('should clear history', async () => {
      mockPrismaService.user.upsert.mockResolvedValue({
        id: 'user-id-1',
        xp: 0,
        currentStreak: 0,
        level: 1,
      })

      await service.handleMessage(testUser, '/start')
      service.clearHistory(testUser.id)

      const history = service.getHistory(testUser.id)
      expect(history.length).toBe(0)
    })
  })
})
