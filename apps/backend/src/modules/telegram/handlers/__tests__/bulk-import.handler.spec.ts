import { Test, TestingModule } from '@nestjs/testing'
import { PinoLogger } from 'nestjs-pino'
import { Context } from 'telegraf'
import { PrismaService } from '../../../../common/prisma/prisma.service'
import { RedisService } from '../../../../common/redis/redis.service'
import { CollectionsService } from '../../../collections/collections.service'
import { PersonalCollectionService } from '../../../collections/personal-collection.service'
import { LLMService } from '../../../llm/llm.service'
import { QuizService } from '../../../quiz/quiz.service'
import { WordsService } from '../../../words/words.service'
import { BulkImportHandler } from '../bulk-import.handler'
import { QuizHandler } from '../quiz.handler'
import { WordEditHandler } from '../word-edit.handler'

describe('BulkImportHandler', () => {
  let bulkImportHandler: BulkImportHandler
  let quizHandler: QuizHandler

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
    },
    word: {
      findMany: jest.fn(),
    },
  }

  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    setJson: jest.fn(),
    getJson: jest.fn(),
    getClient: jest.fn().mockReturnValue({
      hset: jest.fn(),
      hlen: jest.fn().mockResolvedValue(0),
      scard: jest.fn().mockResolvedValue(0),
      sadd: jest.fn(),
      expire: jest.fn(),
      hgetall: jest.fn().mockResolvedValue({}),
      smembers: jest.fn().mockResolvedValue([]),
    }),
  }

  const mockWordsService = {
    findByGeorgianAndRussian: jest.fn(),
    create: jest.fn(),
  }

  const mockCollectionsService = {
    addWords: jest.fn(),
  }

  const mockPersonalCollectionService = {
    getOrCreate: jest.fn(),
  }

  const mockLLMService = {
    checkBudget: jest.fn(),
    translateBatch: jest.fn(),
  }

  const mockQuizService = {
    getCurrentSession: jest.fn(),
  }

  const mockWordEditHandler = {
    handleEditInput: jest.fn(),
  }

  beforeEach(async () => {
    jest.clearAllMocks()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BulkImportHandler,
        QuizHandler,
        { provide: PinoLogger, useValue: mockLogger },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: WordsService, useValue: mockWordsService },
        { provide: CollectionsService, useValue: mockCollectionsService },
        { provide: PersonalCollectionService, useValue: mockPersonalCollectionService },
        { provide: LLMService, useValue: mockLLMService },
        { provide: QuizService, useValue: mockQuizService },
        { provide: WordEditHandler, useValue: mockWordEditHandler },
      ],
    }).compile()

    bulkImportHandler = module.get<BulkImportHandler>(BulkImportHandler)
    quizHandler = module.get<QuizHandler>(QuizHandler)
  })

  const createMockContext = (text: string, telegramId: number = 352328891) => {
    const mockCtx = {
      from: { id: telegramId, first_name: 'Test' },
      message: { text },
      reply: jest.fn().mockResolvedValue({}),
      answerCbQuery: jest.fn(),
      editMessageText: jest.fn(),
    } as unknown as Context
    return mockCtx
  }

  describe('Bulk Import Flow', () => {
    it('should start import mode with /import command', async () => {
      const ctx = createMockContext('/import')
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        telegramId: BigInt(352328891),
      })

      await bulkImportHandler.onImportCommand(ctx)

      expect(mockRedis.setJson).toHaveBeenCalledWith(
        'bulk_import:352328891',
        expect.objectContaining({
          state: 'collecting',
          userId: 'user-123',
        }),
        3600,
      )
      expect(ctx.reply).toHaveBeenCalled()
    })

    it('should delegate text messages to BulkImportHandler when in collecting mode', async () => {
      const ctx = createMockContext('გამარჯობა')

      // User exists
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        telegramId: BigInt(352328891),
      })

      // Session exists in collecting state
      mockRedis.get.mockResolvedValue(
        JSON.stringify({
          userId: 'user-123',
          telegramId: '352328891',
          words: [],
          state: 'collecting',
          createdAt: new Date().toISOString(),
        }),
      )

      mockRedis.getJson.mockResolvedValue({
        userId: 'user-123',
        telegramId: '352328891',
        words: [],
        state: 'collecting',
        createdAt: new Date().toISOString(),
      })

      // No active quiz
      mockQuizService.getCurrentSession.mockResolvedValue(null)
      mockWordEditHandler.handleEditInput.mockResolvedValue(false)

      // Call QuizHandler (which should delegate to BulkImportHandler)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await quizHandler.onTextMessage(ctx as any)

      // Should log delegation
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ telegramId: 352328891 }),
        'Delegating to BulkImportHandler',
      )
    })

    it('should collect Georgian words when in collecting mode', async () => {
      const ctx = createMockContext('გამარჯობა - привет')

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        telegramId: BigInt(352328891),
      })

      mockRedis.getJson.mockResolvedValue({
        userId: 'user-123',
        telegramId: '352328891',
        words: [],
        state: 'collecting',
        createdAt: new Date().toISOString(),
      })

      await bulkImportHandler.onText(ctx)

      // Should store word pairs
      expect(mockRedis.getClient().hset).toHaveBeenCalled()
      expect(ctx.reply).toHaveBeenCalled()
    })
  })
})
