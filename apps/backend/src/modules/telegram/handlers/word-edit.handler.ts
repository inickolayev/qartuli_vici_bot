import { Injectable } from '@nestjs/common'
import { Action, Ctx, Update } from 'nestjs-telegraf'
import { Context } from 'telegraf'
import { Markup } from 'telegraf'
import { PinoLogger } from 'nestjs-pino'
import { PrismaService } from '../../../common/prisma/prisma.service'
import { RedisService } from '../../../common/redis/redis.service'
import { MESSAGES, formatMessage } from '../constants/messages'

interface WordEditSession {
  wordId: string
  action: 'edit_primary' | 'add_alt' | null
  quizAnswerId?: string
}

@Update()
@Injectable()
export class WordEditHandler {
  private readonly SESSION_TTL = 300 // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(WordEditHandler.name)
  }

  /**
   * Open word edit menu (from quiz incorrect answer)
   */
  @Action(/^word:edit:(.+)$/)
  async onEditWord(@Ctx() ctx: Context) {
    try {
      const from = ctx.from
      if (!from) return

      const callbackData = 'data' in ctx.callbackQuery! ? ctx.callbackQuery.data : ''
      const match = callbackData.match(/^word:edit:(.+)$/)

      if (!match) {
        await ctx.answerCbQuery('Ошибка')
        return
      }

      const wordId = match[1]

      const word = await this.prisma.word.findUnique({
        where: { id: wordId },
      })

      if (!word) {
        await ctx.answerCbQuery('Слово не найдено')
        return
      }

      const russianAltText = word.russianAlt.length > 0 ? word.russianAlt.join(', ') : '(нет)'

      const message = formatMessage(MESSAGES.WORD_EDIT_MENU, {
        georgian: word.georgian,
        russianPrimary: word.russianPrimary,
        russianAlt: russianAltText,
      })

      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📝 Изменить перевод', `word:edit_primary:${wordId}`)],
          [Markup.button.callback('➕ Добавить альтернативу', `word:add_alt:${wordId}`)],
          [Markup.button.callback('❌ Отмена', 'word:edit_cancel')],
        ]),
      })

      await ctx.answerCbQuery()
    } catch (error) {
      this.logger.error({ error }, 'Failed to open word edit menu')
      await ctx.answerCbQuery('Ошибка')
    }
  }

  /**
   * Start editing primary translation
   */
  @Action(/^word:edit_primary:(.+)$/)
  async onEditPrimary(@Ctx() ctx: Context) {
    try {
      const from = ctx.from
      if (!from) return

      const callbackData = 'data' in ctx.callbackQuery! ? ctx.callbackQuery.data : ''
      const match = callbackData.match(/^word:edit_primary:(.+)$/)

      if (!match) {
        await ctx.answerCbQuery('Ошибка')
        return
      }

      const wordId = match[1]

      const word = await this.prisma.word.findUnique({
        where: { id: wordId },
      })

      if (!word) {
        await ctx.answerCbQuery('Слово не найдено')
        return
      }

      // Save edit session to Redis
      const session: WordEditSession = {
        wordId,
        action: 'edit_primary',
      }

      await this.redis.setJson(`word_edit:${from.id}`, session, this.SESSION_TTL)

      const message = formatMessage(MESSAGES.WORD_EDIT_NEW_PRIMARY, {
        georgian: word.georgian,
      })

      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('❌ Отмена', 'word:edit_cancel')]]),
      })

      await ctx.answerCbQuery()
    } catch (error) {
      this.logger.error({ error }, 'Failed to start edit primary')
      await ctx.answerCbQuery('Ошибка')
    }
  }

  /**
   * Start adding alternative translation
   */
  @Action(/^word:add_alt:(.+)$/)
  async onAddAlt(@Ctx() ctx: Context) {
    try {
      const from = ctx.from
      if (!from) return

      const callbackData = 'data' in ctx.callbackQuery! ? ctx.callbackQuery.data : ''
      const match = callbackData.match(/^word:add_alt:(.+)$/)

      if (!match) {
        await ctx.answerCbQuery('Ошибка')
        return
      }

      const wordId = match[1]

      const word = await this.prisma.word.findUnique({
        where: { id: wordId },
      })

      if (!word) {
        await ctx.answerCbQuery('Слово не найдено')
        return
      }

      // Save edit session to Redis
      const session: WordEditSession = {
        wordId,
        action: 'add_alt',
      }

      await this.redis.setJson(`word_edit:${from.id}`, session, this.SESSION_TTL)

      const russianAltText = word.russianAlt.length > 0 ? word.russianAlt.join(', ') : '(нет)'

      const message = formatMessage(MESSAGES.WORD_EDIT_ADD_ALT, {
        georgian: word.georgian,
        russianAlt: russianAltText,
      })

      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('❌ Отмена', 'word:edit_cancel')]]),
      })

      await ctx.answerCbQuery()
    } catch (error) {
      this.logger.error({ error }, 'Failed to start add alt')
      await ctx.answerCbQuery('Ошибка')
    }
  }

  /**
   * Cancel word editing
   */
  @Action('word:edit_cancel')
  async onEditCancel(@Ctx() ctx: Context) {
    try {
      const from = ctx.from
      if (!from) return

      await this.redis.del(`word_edit:${from.id}`)

      await ctx.editMessageText(MESSAGES.WORD_EDIT_CANCELLED, {
        parse_mode: 'HTML',
      })

      await ctx.answerCbQuery('Отменено')
    } catch (error) {
      this.logger.error({ error }, 'Failed to cancel edit')
      await ctx.answerCbQuery('Ошибка')
    }
  }

  /**
   * Handle text input for word editing
   * This runs BEFORE quiz handler due to decorator order
   */
  async handleEditInput(ctx: Context): Promise<boolean> {
    const from = ctx.from
    if (!from || !('text' in ctx.message!)) return false

    const session = await this.redis.getJson<WordEditSession>(`word_edit:${from.id}`)

    if (!session || !session.action) {
      return false // No active edit session
    }

    const input = ctx.message.text.trim()

    if (!input || input.startsWith('/')) {
      return false // Empty or command
    }

    try {
      const word = await this.prisma.word.findUnique({
        where: { id: session.wordId },
      })

      if (!word) {
        await ctx.reply('Слово не найдено')
        await this.redis.del(`word_edit:${from.id}`)
        return true
      }

      if (session.action === 'edit_primary') {
        // Update primary translation
        const updatedWord = await this.prisma.word.update({
          where: { id: session.wordId },
          data: { russianPrimary: input },
        })

        const russianAltText =
          updatedWord.russianAlt.length > 0 ? updatedWord.russianAlt.join(', ') : '(нет)'

        const message = formatMessage(MESSAGES.WORD_EDIT_SUCCESS, {
          georgian: updatedWord.georgian,
          russianPrimary: updatedWord.russianPrimary,
          russianAlt: russianAltText,
        })

        await ctx.reply(message, { parse_mode: 'HTML' })

        this.logger.info(
          { wordId: session.wordId, newPrimary: input },
          'Word primary translation updated',
        )
      } else if (session.action === 'add_alt') {
        // Add alternative translation
        const updatedWord = await this.prisma.word.update({
          where: { id: session.wordId },
          data: {
            russianAlt: {
              push: input,
            },
          },
        })

        const russianAltText = updatedWord.russianAlt.join(', ')

        const message = formatMessage(MESSAGES.WORD_EDIT_SUCCESS, {
          georgian: updatedWord.georgian,
          russianPrimary: updatedWord.russianPrimary,
          russianAlt: russianAltText,
        })

        await ctx.reply(message, { parse_mode: 'HTML' })

        this.logger.info({ wordId: session.wordId, newAlt: input }, 'Word alternative added')
      }

      // Clear edit session
      await this.redis.del(`word_edit:${from.id}`)

      return true
    } catch (error) {
      this.logger.error({ error }, 'Failed to process edit input')
      await ctx.reply('Ошибка при сохранении')
      await this.redis.del(`word_edit:${from.id}`)
      return true
    }
  }
}
