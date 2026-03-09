import { Injectable } from '@nestjs/common'
import { Update, Ctx, Action, On } from 'nestjs-telegraf'
import { Context } from 'telegraf'
import { PinoLogger } from 'nestjs-pino'
import { PrismaService } from '../../../common/prisma/prisma.service'
import { RedisService } from '../../../common/redis/redis.service'
import { WordsService } from '../../words/words.service'
import { CollectionsService } from '../../collections/collections.service'
import { PersonalCollectionService } from '../../collections/personal-collection.service'
import { LLMService } from '../../llm/llm.service'
import { MESSAGES, formatMessage } from '../constants/messages'
import { createBackToMenuKeyboard } from '../keyboards/main.keyboard'
import {
  createBulkImportConfirmKeyboard,
  createBulkImportPreviewKeyboard,
  createBulkImportCancelKeyboard,
} from '../keyboards/bulk-import.keyboard'
import { BulkImportSession, BulkImportState } from '../types/bulk-import.types'

const GEORGIAN_WORD_REGEX = /[\u10A0-\u10FF]+/g
const BULK_IMPORT_TTL = 3600 // 1 hour
const MIN_WORDS_FOR_BULK = 3
const MAX_WORDS_FOR_BULK = 50

/**
 * Handler for bulk word import - detects list of Georgian words and offers to translate
 */
@Update()
@Injectable()
export class BulkImportHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly wordsService: WordsService,
    private readonly collectionsService: CollectionsService,
    private readonly personalCollectionService: PersonalCollectionService,
    private readonly llmService: LLMService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(BulkImportHandler.name)
  }

  /**
   * Detect Georgian word lists in messages
   */
  @On('text')
  async onText(@Ctx() ctx: Context) {
    try {
      const from = ctx.from
      const message = ctx.message

      if (!from || !message || !('text' in message)) {
        return
      }

      const text = message.text

      // Skip commands
      if (text.startsWith('/')) {
        return
      }

      // Extract Georgian words
      const georgianWords = this.extractGeorgianWords(text)

      // Check if it looks like a word list (minimum threshold)
      if (georgianWords.length < MIN_WORDS_FOR_BULK) {
        return
      }

      // Limit max words
      const words = georgianWords.slice(0, MAX_WORDS_FOR_BULK)

      // Get user
      const user = await this.prisma.user.findUnique({
        where: { telegramId: BigInt(from.id) },
      })

      if (!user) {
        return // Not registered, ignore
      }

      // Create import session
      const session: BulkImportSession = {
        userId: user.id,
        telegramId: from.id.toString(),
        words,
        state: BulkImportState.DETECTED,
        createdAt: new Date(),
      }

      await this.saveSession(from.id.toString(), session)

      const response = formatMessage(MESSAGES.BULK_IMPORT_DETECTED, {
        count: words.length,
        preview: words.slice(0, 5).join(', ') + (words.length > 5 ? '...' : ''),
      })

      await ctx.reply(response, {
        parse_mode: 'HTML',
        ...createBulkImportConfirmKeyboard(),
      })

      this.logger.info({ userId: user.id, wordCount: words.length }, 'Bulk import detected')
    } catch (error) {
      this.logger.error({ error }, 'Failed to detect bulk import')
      // Don't reply with error - this is a background detection
    }
  }

  @Action('bulk:translate')
  async onTranslate(@Ctx() ctx: Context) {
    try {
      const from = ctx.from
      if (!from) return

      const session = await this.getSession(from.id.toString())
      if (!session) {
        await ctx.answerCbQuery('Сессия импорта истекла')
        await ctx.editMessageReplyMarkup(undefined)
        return
      }

      // Check LLM budget
      const budget = await this.llmService.checkBudget()
      if (budget.isExceeded) {
        await ctx.answerCbQuery('Достигнут дневной лимит переводов')
        await ctx.editMessageText(MESSAGES.BULK_IMPORT_BUDGET_EXCEEDED, { parse_mode: 'HTML' })
        await this.deleteSession(from.id.toString())
        return
      }

      // Update state (immutable)
      const translatingSession: BulkImportSession = {
        ...session,
        state: BulkImportState.TRANSLATING,
      }
      await this.saveSession(from.id.toString(), translatingSession)

      await ctx.answerCbQuery()
      await ctx.editMessageText(
        formatMessage(MESSAGES.BULK_IMPORT_TRANSLATING, { count: session.words.length }),
        { parse_mode: 'HTML', ...createBulkImportCancelKeyboard() },
      )

      // Translate words
      const result = await this.llmService.translateBatch(session.words)

      // Update session with translations (immutable)
      const previewSession: BulkImportSession = {
        ...translatingSession,
        translations: result.translations,
        state: BulkImportState.PREVIEW,
      }
      await this.saveSession(from.id.toString(), previewSession)

      // Build preview message
      const preview = result.translations
        .slice(0, 15)
        .map((t, i) => `${i + 1}. <b>${t.georgian}</b> — ${t.russianPrimary}`)
        .join('\n')

      const previewMessage = formatMessage(MESSAGES.BULK_IMPORT_PREVIEW, {
        count: result.translations.length,
        preview,
        more:
          result.translations.length > 15 ? `\n...и ещё ${result.translations.length - 15}` : '',
        cost: result.costUsd.toFixed(4),
      })

      await ctx.editMessageText(previewMessage, {
        parse_mode: 'HTML',
        ...createBulkImportPreviewKeyboard(),
      })

      this.logger.info(
        { userId: session.userId, wordCount: result.translations.length, costUsd: result.costUsd },
        'Bulk translation completed',
      )
    } catch (error) {
      this.logger.error({ error }, 'Failed to translate bulk import')
      await ctx.editMessageText(MESSAGES.ERROR_GENERIC, {
        parse_mode: 'HTML',
        ...createBackToMenuKeyboard(),
      })
    }
  }

  @Action('bulk:confirm')
  async onConfirm(@Ctx() ctx: Context) {
    try {
      const from = ctx.from
      if (!from) return

      const session = await this.getSession(from.id.toString())
      if (!session || !session.translations) {
        await ctx.answerCbQuery('Сессия импорта истекла')
        await ctx.editMessageReplyMarkup(undefined)
        return
      }

      const savingSession: BulkImportSession = {
        ...session,
        state: BulkImportState.SAVING,
      }
      await this.saveSession(from.id.toString(), savingSession)

      await ctx.answerCbQuery('Сохраняю...')

      // Get or create personal collection
      const collection = await this.personalCollectionService.getOrCreate(session.userId)

      // Create words and add to collection
      let savedCount = 0
      const wordIds: string[] = []

      for (const translation of session.translations) {
        try {
          // Check if word exists
          let word = await this.wordsService.findByGeorgianAndRussian(
            translation.georgian,
            translation.russianPrimary,
          )

          if (!word) {
            word = await this.wordsService.create(
              {
                georgian: translation.georgian,
                russianPrimary: translation.russianPrimary,
                russianAlt: translation.russianAlt,
                transcription: translation.transcription,
              },
              session.userId,
            )
          }

          wordIds.push(word.id)
          savedCount++
        } catch (error) {
          this.logger.warn({ error, georgian: translation.georgian }, 'Failed to save word')
        }
      }

      // Add all words to collection
      if (wordIds.length > 0) {
        try {
          await this.collectionsService.addWords(collection.id, wordIds)
        } catch (error) {
          this.logger.warn({ error }, 'Some words might already be in collection')
        }
      }

      // Cleanup session
      await this.deleteSession(from.id.toString())

      await ctx.editMessageText(
        formatMessage(MESSAGES.BULK_IMPORT_SUCCESS, {
          count: savedCount,
          collectionName: collection.name,
        }),
        { parse_mode: 'HTML', ...createBackToMenuKeyboard() },
      )

      this.logger.info(
        { userId: session.userId, savedCount, collectionId: collection.id },
        'Bulk import completed',
      )
    } catch (error) {
      this.logger.error({ error }, 'Failed to save bulk import')
      await ctx.editMessageText(MESSAGES.ERROR_GENERIC, {
        parse_mode: 'HTML',
        ...createBackToMenuKeyboard(),
      })
    }
  }

  @Action('bulk:cancel')
  async onCancel(@Ctx() ctx: Context) {
    try {
      const from = ctx.from
      if (!from) return

      await this.deleteSession(from.id.toString())
      await ctx.answerCbQuery('Импорт отменён')
      await ctx.editMessageText(MESSAGES.BULK_IMPORT_CANCELLED, {
        parse_mode: 'HTML',
        ...createBackToMenuKeyboard(),
      })
    } catch (error) {
      this.logger.error({ error }, 'Failed to cancel bulk import')
    }
  }

  private extractGeorgianWords(text: string): string[] {
    const matches = text.match(GEORGIAN_WORD_REGEX)
    if (!matches) return []

    // Deduplicate and filter short words
    const uniqueWords = [...new Set(matches)]
      .filter((word) => word.length >= 2)
      .map((word) => word.trim())

    return uniqueWords
  }

  private getSessionKey(telegramId: string): string {
    return `bulk_import:${telegramId}`
  }

  private async saveSession(telegramId: string, session: BulkImportSession): Promise<void> {
    await this.redis.setJson(this.getSessionKey(telegramId), session, BULK_IMPORT_TTL)
  }

  private async getSession(telegramId: string): Promise<BulkImportSession | null> {
    return this.redis.getJson<BulkImportSession>(this.getSessionKey(telegramId))
  }

  private async deleteSession(telegramId: string): Promise<void> {
    await this.redis.del(this.getSessionKey(telegramId))
  }
}
