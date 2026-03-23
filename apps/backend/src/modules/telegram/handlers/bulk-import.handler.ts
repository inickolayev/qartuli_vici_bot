import { Injectable } from '@nestjs/common'
import { Update, Ctx, Action, On, Command } from 'nestjs-telegraf'
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
  createBulkImportCollectingKeyboard,
  createBulkImportReviewKeyboard,
} from '../keyboards/bulk-import.keyboard'
import { BulkImportSession, BulkImportState, ExistingWord } from '../types/bulk-import.types'

const GEORGIAN_WORD_REGEX = /[\u10A0-\u10FF]+/g
const BULK_IMPORT_TTL = 3600 // 1 hour
const MIN_WORDS_FOR_BULK = 3
const MAX_WORDS_FOR_BULK = 100 // Increased for collection mode

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
   * Start import collection mode
   */
  @Command('import')
  async onImportCommand(@Ctx() ctx: Context) {
    try {
      const from = ctx.from
      if (!from) return

      const user = await this.prisma.user.findUnique({
        where: { telegramId: BigInt(from.id) },
      })

      if (!user) {
        await ctx.reply(MESSAGES.ERROR_NOT_REGISTERED, { parse_mode: 'HTML' })
        return
      }

      // Create collecting session
      const session: BulkImportSession = {
        userId: user.id,
        telegramId: from.id.toString(),
        words: [],
        state: BulkImportState.COLLECTING,
        createdAt: new Date(),
        lastMessageAt: new Date(),
      }

      await this.saveSession(from.id.toString(), session)

      await ctx.reply(MESSAGES.BULK_IMPORT_COLLECTING_START, {
        parse_mode: 'HTML',
        ...createBulkImportCollectingKeyboard(0),
      })

      this.logger.info({ userId: user.id }, 'Import collection mode started')
    } catch (error) {
      this.logger.error({ error }, 'Failed to start import')
      await ctx.reply(MESSAGES.ERROR_GENERIC, { parse_mode: 'HTML' })
    }
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

      // Get user
      const user = await this.prisma.user.findUnique({
        where: { telegramId: BigInt(from.id) },
      })

      if (!user) {
        return // Not registered, ignore
      }

      // Check if in collecting mode
      const existingSession = await this.getSession(from.id.toString())

      if (existingSession?.state === BulkImportState.COLLECTING) {
        // Add words to existing session
        await this.addWordsToSession(ctx, existingSession, text)
        return
      }

      // Regular detection mode
      const georgianWords = this.extractGeorgianWords(text)

      // Check if it looks like a word list (minimum threshold)
      if (georgianWords.length < MIN_WORDS_FOR_BULK) {
        return
      }

      // Limit max words
      const words = georgianWords.slice(0, MAX_WORDS_FOR_BULK)

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

  /**
   * Add words to collecting session using atomic Redis operations
   */
  private async addWordsToSession(
    ctx: Context,
    session: BulkImportSession,
    text: string,
  ): Promise<void> {
    // First try to parse word pairs (Georgian - Russian)
    const wordPairs = this.parseWordPairs(text)

    // If no pairs found, fall back to just Georgian words
    const georgianWords = wordPairs.length > 0 ? [] : this.extractGeorgianWords(text)

    if (wordPairs.length === 0 && georgianWords.length === 0) {
      return // No Georgian words, ignore
    }

    const pairsKey = `bulk_import_pairs:${session.telegramId}`
    const wordsKey = `bulk_import_words:${session.telegramId}`

    // Store word pairs as hash (georgian -> russian)
    if (wordPairs.length > 0) {
      const hashData: Record<string, string> = {}
      for (const pair of wordPairs) {
        hashData[pair.georgian] = pair.russian
      }
      await this.redis.getClient().hset(pairsKey, hashData)
      await this.redis.getClient().expire(pairsKey, BULK_IMPORT_TTL)
    }

    // Store standalone Georgian words in SET
    if (georgianWords.length > 0) {
      await this.redis.getClient().sadd(wordsKey, ...georgianWords)
      await this.redis.getClient().expire(wordsKey, BULK_IMPORT_TTL)
    }

    // Get current totals
    const pairsCount = await this.redis.getClient().hlen(pairsKey)
    const wordsCount = await this.redis.getClient().scard(wordsKey)
    const totalCount = pairsCount + wordsCount

    // Update session timestamp
    const updatedSession: BulkImportSession = {
      ...session,
      lastMessageAt: new Date(),
    }
    await this.saveSession(session.telegramId, updatedSession)

    // Build preview with translations
    let preview: string
    if (wordPairs.length > 0) {
      preview = wordPairs
        .slice(0, 5)
        .map((p) => `<b>${p.georgian}</b> — ${p.russian}`)
        .join('\n')
      if (wordPairs.length > 5) {
        preview += `\n<i>...и ещё ${wordPairs.length - 5}</i>`
      }
    } else {
      preview = georgianWords.slice(0, 5).join(', ')
      if (georgianWords.length > 5) {
        preview += ` (+${georgianWords.length - 5})`
      }
    }

    await ctx.reply(
      formatMessage(MESSAGES.BULK_IMPORT_COLLECTING_ADDED, {
        added: wordPairs.length || georgianWords.length,
        total: totalCount,
        preview,
      }),
      {
        parse_mode: 'HTML',
        ...createBulkImportCollectingKeyboard(totalCount),
      },
    )
  }

  /**
   * Get collected word pairs from Redis HASH
   */
  private async getCollectedPairs(
    telegramId: string,
  ): Promise<Array<{ georgian: string; russian: string }>> {
    const pairsKey = `bulk_import_pairs:${telegramId}`
    const hash = await this.redis.getClient().hgetall(pairsKey)

    return Object.entries(hash).map(([georgian, russian]) => ({ georgian, russian }))
  }

  /**
   * Get collected standalone words from Redis SET
   */
  private async getCollectedWords(telegramId: string): Promise<string[]> {
    const wordsKey = `bulk_import_words:${telegramId}`
    const words = await this.redis.getClient().smembers(wordsKey)
    return words.slice(0, MAX_WORDS_FOR_BULK)
  }

  /**
   * Clear all collected data from Redis
   */
  private async clearCollectedWords(telegramId: string): Promise<void> {
    const pairsKey = `bulk_import_pairs:${telegramId}`
    const wordsKey = `bulk_import_words:${telegramId}`
    await this.redis.del(pairsKey)
    await this.redis.del(wordsKey)
  }

  /**
   * Finish collecting and review words
   */
  @Action('bulk:done')
  async onDoneCollecting(@Ctx() ctx: Context) {
    try {
      const from = ctx.from
      if (!from) return

      const session = await this.getSession(from.id.toString())
      if (!session || session.state !== BulkImportState.COLLECTING) {
        await ctx.answerCbQuery('Сессия импорта истекла')
        return
      }

      // Get word pairs (with translations) and standalone words
      const collectedPairs = await this.getCollectedPairs(from.id.toString())
      const collectedWords = await this.getCollectedWords(from.id.toString())

      const totalCount = collectedPairs.length + collectedWords.length

      if (totalCount === 0) {
        await ctx.answerCbQuery('Нет слов для импорта')
        return
      }

      await ctx.answerCbQuery()

      // Check which words already exist (all Georgian words)
      const allGeorgianWords = [...collectedPairs.map((p) => p.georgian), ...collectedWords]
      const { existingWords, newWords: newGeorgianWords } = await this.checkExistingWords(
        session.userId,
        allGeorgianWords,
      )

      // Separate new pairs (have translation) from words needing translation
      const newPairs = collectedPairs.filter((p) => newGeorgianWords.includes(p.georgian))
      const wordsToTranslate = collectedWords.filter((w) => newGeorgianWords.includes(w))

      const updatedSession: BulkImportSession = {
        ...session,
        words: allGeorgianWords,
        parsedWords: collectedPairs,
        existingWords,
        newWords: newGeorgianWords,
        wordsToTranslate,
        state: BulkImportState.DETECTED,
      }

      await this.saveSession(from.id.toString(), updatedSession)

      // Clear Redis (data now in session)
      await this.clearCollectedWords(from.id.toString())

      // Build review message
      let message = `📥 <b>Собрано ${totalCount} слов</b>\n\n`

      if (existingWords.length > 0) {
        message += `✅ <b>Уже есть (${existingWords.length}):</b>\n`
        for (const word of existingWords.slice(0, 5)) {
          message += `• ${word.georgian} — ${word.russianPrimary}\n`
        }
        if (existingWords.length > 5) {
          message += `<i>...и ещё ${existingWords.length - 5}</i>\n`
        }
        message += '\n'
      }

      if (newPairs.length > 0) {
        message += `🆕 <b>Новые с переводом (${newPairs.length}):</b>\n`
        for (const pair of newPairs.slice(0, 10)) {
          message += `• <b>${pair.georgian}</b> — ${pair.russian}\n`
        }
        if (newPairs.length > 10) {
          message += `<i>...и ещё ${newPairs.length - 10}</i>\n`
        }
        message += '\n'
      }

      if (wordsToTranslate.length > 0) {
        message += `🔄 <b>Нужен перевод (${wordsToTranslate.length}):</b>\n`
        for (const word of wordsToTranslate.slice(0, 5)) {
          message += `• ${word}\n`
        }
        if (wordsToTranslate.length > 5) {
          message += `<i>...и ещё ${wordsToTranslate.length - 5}</i>\n`
        }
      }

      const hasNewWords = newPairs.length > 0 || wordsToTranslate.length > 0

      if (!hasNewWords) {
        message += `\n✨ Все слова уже есть в твоей коллекции!`
      }

      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        ...createBulkImportReviewKeyboard(hasNewWords, wordsToTranslate.length > 0),
      })

      this.logger.info(
        {
          userId: session.userId,
          existing: existingWords.length,
          newPairs: newPairs.length,
          toTranslate: wordsToTranslate.length,
        },
        'Import review ready',
      )
    } catch (error) {
      this.logger.error({ error }, 'Failed to finish collecting')
      await ctx.answerCbQuery('Ошибка')
    }
  }

  /**
   * Check which words already exist in user's collections
   */
  private async checkExistingWords(
    userId: string,
    words: string[],
  ): Promise<{ existingWords: ExistingWord[]; newWords: string[] }> {
    const existingWords: ExistingWord[] = []
    const newWords: string[] = []

    // Get all words from user's collections
    const userWords = await this.prisma.word.findMany({
      where: {
        georgian: { in: words },
        OR: [
          // Words in user's collections
          {
            collections: {
              some: {
                collection: {
                  users: {
                    some: { userId },
                  },
                },
              },
            },
          },
          // Or words with user progress
          {
            userProgress: {
              some: { userId },
            },
          },
        ],
      },
      select: {
        georgian: true,
        russianPrimary: true,
      },
    })

    for (const word of words) {
      const found = userWords.find((w) => w.georgian === word)
      if (found) {
        existingWords.push({ georgian: found.georgian, russianPrimary: found.russianPrimary })
      } else {
        newWords.push(word)
      }
    }

    return { existingWords, newWords }
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

      // Use newWords if available (from collection mode), otherwise all words
      const wordsToTranslate = session.newWords || session.words

      if (wordsToTranslate.length === 0) {
        await ctx.answerCbQuery('Нет новых слов для перевода')
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
        formatMessage(MESSAGES.BULK_IMPORT_TRANSLATING, { count: wordsToTranslate.length }),
        { parse_mode: 'HTML', ...createBulkImportCancelKeyboard() },
      )

      // Translate words
      const result = await this.llmService.translateBatch(wordsToTranslate)

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

  /**
   * Save words that already have translations (no GPT needed)
   */
  @Action('bulk:save_pairs')
  async onSavePairs(@Ctx() ctx: Context) {
    try {
      const from = ctx.from
      if (!from) return

      const session = await this.getSession(from.id.toString())
      if (!session || !session.parsedWords) {
        await ctx.answerCbQuery('Сессия импорта истекла')
        return
      }

      // Filter to only new pairs (not already in collection)
      const newPairs = session.parsedWords.filter((p) => session.newWords?.includes(p.georgian))

      if (newPairs.length === 0) {
        await ctx.answerCbQuery('Нет новых слов для сохранения')
        return
      }

      await ctx.answerCbQuery('Сохраняю...')

      // Get or create personal collection
      const collection = await this.personalCollectionService.getOrCreate(session.userId)

      // Create words and add to collection
      let savedCount = 0
      const wordIds: string[] = []

      for (const pair of newPairs) {
        try {
          if (!pair.russian) continue // Skip pairs without translation

          // Check if word exists
          let word = await this.wordsService.findByGeorgianAndRussian(pair.georgian, pair.russian)

          if (!word) {
            word = await this.wordsService.create(
              {
                georgian: pair.georgian,
                russianPrimary: pair.russian,
                russianAlt: [],
              },
              session.userId,
            )
          }

          wordIds.push(word.id)
          savedCount++
        } catch (error) {
          this.logger.warn({ error, georgian: pair.georgian }, 'Failed to save word')
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
        'Pairs import completed',
      )
    } catch (error) {
      this.logger.error({ error }, 'Failed to save pairs')
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
      await this.clearCollectedWords(from.id.toString())
      await ctx.answerCbQuery('Импорт отменён')
      await ctx.editMessageText(MESSAGES.BULK_IMPORT_CANCELLED, {
        parse_mode: 'HTML',
        ...createBackToMenuKeyboard(),
      })
    } catch (error) {
      this.logger.error({ error }, 'Failed to cancel bulk import')
    }
  }

  /**
   * Extract Georgian words (simple extraction)
   */
  private extractGeorgianWords(text: string): string[] {
    const matches = text.match(GEORGIAN_WORD_REGEX)
    if (!matches) return []

    // Deduplicate and filter short words
    const uniqueWords = [...new Set(matches)]
      .filter((word) => word.length >= 2)
      .map((word) => word.trim())

    return uniqueWords
  }

  /**
   * Parse word pairs in format "Georgian - Russian" from text
   * Returns array of {georgian, russian} objects
   */
  private parseWordPairs(text: string): Array<{ georgian: string; russian: string }> {
    const pairs: Array<{ georgian: string; russian: string }> = []

    // Split by newlines and process each line
    const lines = text.split('\n')

    for (const line of lines) {
      // Try to match pattern: Georgian word(s) - Russian translation
      // Handle formats like:
      // კამათი - ссора
      // კამათი — ссора (em dash)
      // კამათი: ссора
      const match = line.match(/([ა-ჰ]+(?:\s+[ა-ჰ]+)*)\s*[-—:]\s*(.+)/u)

      if (match) {
        const georgian = match[1].trim()
        const russian = match[2]
          .trim()
          .replace(/^\[.*?\]\s*/, '') // Remove timestamps like [10.03.2026 00:39]
          .replace(/^[^:]+:\s*/, '') // Remove usernames like "Igor Nikolaev:"
          .split(/[,;]/)[0] // Take first translation if multiple
          .trim()

        if (georgian.length >= 2 && russian.length >= 1) {
          pairs.push({ georgian, russian })
        }
      }
    }

    return pairs
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
