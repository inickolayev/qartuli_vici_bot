import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { QuizSessionStatus, VerificationMethod } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service'
import { RedisService } from '../../common/redis/redis.service'
import { WordSelectorService } from './services/word-selector.service'
import { ProgressService } from './services/progress.service'
import { ExerciseGenerator } from './generators/exercise.generator'
import { ExactMatchValidator } from './validators/exact-match.validator'
import { NormalizedMatchValidator } from './validators/normalized-match.validator'
import { AnswerValidator } from './validators/validator.interface'
import { StartQuizDto } from './dto/start-quiz.dto'
import { SubmitAnswerDto } from './dto/submit-answer.dto'
import { QuizState, ValidationContext } from './types/quiz.types'

@Injectable()
export class QuizService {
  private readonly validators: AnswerValidator[]
  private readonly QUIZ_STATE_TTL = 3600 // 1 hour

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly wordSelector: WordSelectorService,
    private readonly progressService: ProgressService,
    private readonly exerciseGenerator: ExerciseGenerator,
    private readonly exactMatchValidator: ExactMatchValidator,
    private readonly normalizedMatchValidator: NormalizedMatchValidator,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(QuizService.name)

    // Validator chain - order matters (cheap checks first)
    this.validators = [this.exactMatchValidator, this.normalizedMatchValidator]
  }

  /**
   * Start a new quiz session
   */
  async startQuiz(userId: string, dto: StartQuizDto) {
    try {
      // Check for existing active session
      const existingSession = await this.prisma.quizSession.findFirst({
        where: {
          userId,
          status: QuizSessionStatus.IN_PROGRESS,
        },
      })

      if (existingSession) {
        throw new BadRequestException('Active quiz session already exists')
      }

      // Select words for quiz
      const words = await this.wordSelector.selectWords(userId, dto.questionCount || 5)

      if (words.length === 0) {
        throw new BadRequestException(
          'No words available for quiz. Please add some collections first.',
        )
      }

      // Generate exercises
      const exercises = words.map((word) => this.exerciseGenerator.generate(word))

      // Create quiz session
      const session = await this.prisma.quizSession.create({
        data: {
          userId,
          type: dto.type,
          status: QuizSessionStatus.IN_PROGRESS,
          totalQuestions: exercises.length,
          correctAnswers: 0,
          xpEarned: 0,
        },
      })

      // Create quiz answers
      await this.prisma.quizAnswer.createMany({
        data: exercises.map((exercise) => ({
          sessionId: session.id,
          wordId: exercise.wordId,
          exerciseType: exercise.type,
          question: exercise.question,
          correctAnswer: exercise.correctAnswer,
          options: exercise.options,
        })),
      })

      // Cache quiz state in Redis
      const quizState: QuizState = {
        sessionId: session.id,
        userId,
        currentQuestionIndex: 0,
        exercises,
        startedAt: session.startedAt,
      }

      await this.redis.setJson(`quiz:session:${session.id}`, quizState, this.QUIZ_STATE_TTL)

      this.logger.info(
        { userId, sessionId: session.id, questionCount: exercises.length },
        'Quiz session started',
      )

      return {
        sessionId: session.id,
        totalQuestions: exercises.length,
        currentQuestion: exercises[0],
      }
    } catch (error) {
      this.logger.error({ error, userId }, 'Failed to start quiz')
      throw error
    }
  }

  /**
   * Submit answer for current question
   */
  async submitAnswer(userId: string, dto: SubmitAnswerDto) {
    try {
      // Get quiz state from Redis
      const quizState = await this.redis.getJson<QuizState>(`quiz:session:${dto.sessionId}`)

      if (!quizState) {
        throw new NotFoundException('Quiz session not found or expired')
      }

      if (quizState.userId !== userId) {
        throw new BadRequestException('Quiz session does not belong to user')
      }

      const currentExercise = quizState.exercises[quizState.currentQuestionIndex]

      if (!currentExercise) {
        throw new BadRequestException('No current question available')
      }

      // Get word data for validation
      const word = await this.prisma.word.findUnique({
        where: { id: currentExercise.wordId },
      })

      if (!word) {
        throw new NotFoundException('Word not found')
      }

      // Validate answer
      const validationContext: ValidationContext = {
        userAnswer: dto.userAnswer,
        expectedAnswer: currentExercise.correctAnswer,
        exerciseType: currentExercise.type,
        word: {
          georgian: word.georgian,
          russianPrimary: word.russianPrimary,
          russianAlt: word.russianAlt,
          georgianForms: word.georgianForms,
        },
      }

      const validationResult = await this.validateAnswer(validationContext)
      const answeredAt = new Date()

      // Find the quiz answer record
      const quizAnswers = await this.prisma.quizAnswer.findMany({
        where: { sessionId: dto.sessionId },
        orderBy: { askedAt: 'asc' },
      })

      const currentAnswer = quizAnswers[quizState.currentQuestionIndex]

      if (!currentAnswer) {
        throw new NotFoundException('Quiz answer record not found')
      }

      // Update quiz answer
      await this.prisma.quizAnswer.update({
        where: { id: currentAnswer.id },
        data: {
          userAnswer: dto.userAnswer,
          isCorrect: validationResult.isCorrect,
          answeredAt,
          responseTimeMs: Math.floor(answeredAt.getTime() - currentAnswer.askedAt.getTime()),
          verificationMethod: validationResult.method,
        },
      })

      // Update user word progress
      await this.progressService.updateProgress(
        userId,
        currentExercise.wordId,
        validationResult.isCorrect,
      )

      // Move to next question
      const nextIndex = quizState.currentQuestionIndex + 1
      const isLastQuestion = nextIndex >= quizState.exercises.length

      if (isLastQuestion) {
        await this.completeQuiz(dto.sessionId, userId)
        await this.redis.del(`quiz:session:${dto.sessionId}`)

        return {
          isCorrect: validationResult.isCorrect,
          correctAnswer: currentExercise.correctAnswer,
          isLastQuestion: true,
          sessionCompleted: true,
        }
      } else {
        const updatedState: QuizState = {
          ...quizState,
          currentQuestionIndex: nextIndex,
        }

        await this.redis.setJson(`quiz:session:${dto.sessionId}`, updatedState, this.QUIZ_STATE_TTL)

        return {
          isCorrect: validationResult.isCorrect,
          correctAnswer: currentExercise.correctAnswer,
          isLastQuestion: false,
          nextQuestion: quizState.exercises[nextIndex],
        }
      }
    } catch (error) {
      this.logger.error({ error, userId, sessionId: dto.sessionId }, 'Failed to submit answer')
      throw error
    }
  }

  /**
   * Get current quiz session for user
   */
  async getCurrentSession(userId: string) {
    try {
      const session = await this.prisma.quizSession.findFirst({
        where: {
          userId,
          status: QuizSessionStatus.IN_PROGRESS,
        },
      })

      if (!session) {
        return null
      }

      const quizState = await this.redis.getJson<QuizState>(`quiz:session:${session.id}`)

      if (!quizState) {
        await this.prisma.quizSession.update({
          where: { id: session.id },
          data: { status: QuizSessionStatus.ABANDONED },
        })
        return null
      }

      return {
        sessionId: session.id,
        totalQuestions: quizState.exercises.length,
        currentQuestionIndex: quizState.currentQuestionIndex,
        currentQuestion: quizState.exercises[quizState.currentQuestionIndex],
      }
    } catch (error) {
      this.logger.error({ error, userId }, 'Failed to get current session')
      throw error
    }
  }

  /**
   * Validate answer using validator chain
   */
  private async validateAnswer(
    context: ValidationContext,
  ): Promise<{ isCorrect: boolean; method: VerificationMethod }> {
    for (const validator of this.validators) {
      if (!validator.shouldRun(context)) {
        continue
      }

      const result = await validator.validate(context)

      if (result.isDefinitive) {
        return {
          isCorrect: result.isCorrect,
          method: validator.method,
        }
      }
    }

    // Default to incorrect if no validator is definitive
    return {
      isCorrect: false,
      method: VerificationMethod.NORMALIZED_MATCH,
    }
  }

  /**
   * Complete quiz session
   */
  private async completeQuiz(sessionId: string, userId: string): Promise<void> {
    try {
      const answers = await this.prisma.quizAnswer.findMany({
        where: { sessionId },
      })

      const correctCount = answers.filter((a) => a.isCorrect).length
      const xpEarned = correctCount * 10 // 10 XP per correct answer

      await this.prisma.quizSession.update({
        where: { id: sessionId },
        data: {
          status: QuizSessionStatus.COMPLETED,
          correctAnswers: correctCount,
          xpEarned,
          completedAt: new Date(),
        },
      })

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          xp: { increment: xpEarned },
          lastActivityAt: new Date(),
        },
      })

      this.logger.info(
        { sessionId, userId, correctCount, totalQuestions: answers.length, xpEarned },
        'Quiz session completed',
      )
    } catch (error) {
      this.logger.error({ error, sessionId, userId }, 'Failed to complete quiz')
      throw error
    }
  }
}
