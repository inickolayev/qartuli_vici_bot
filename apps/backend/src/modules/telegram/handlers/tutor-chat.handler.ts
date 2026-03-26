import { Injectable } from '@nestjs/common'
import { Command, Update, Ctx, Action } from 'nestjs-telegraf'
import { Context } from 'telegraf'
import { PinoLogger } from 'nestjs-pino'
import { PrismaService } from '../../../common/prisma/prisma.service'
import { TutorChatService } from '../services/tutor-chat.service'
import { MESSAGES } from '../constants/messages'
import { createTutorChatKeyboard } from '../keyboards/tutor-chat.keyboard'
import { createMainKeyboard } from '../keyboards/main.keyboard'

@Update()
@Injectable()
export class TutorChatHandler {
  constructor(
    private readonly tutorChatService: TutorChatService,
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(TutorChatHandler.name)
  }

  @Command('chat')
  @Action('tutor:start')
  async onStartChat(@Ctx() ctx: Context) {
    try {
      const from = ctx.from
      if (!from) return

      const isCallback = ctx.callbackQuery !== undefined
      if (isCallback) {
        await ctx.answerCbQuery()
      }

      const telegramId = from.id.toString()

      // Check if already in chat mode
      const isActive = await this.tutorChatService.isInChatMode(telegramId)
      if (isActive) {
        const text = MESSAGES.TUTOR_CHAT_ALREADY_ACTIVE
        if (isCallback) {
          await ctx.editMessageText(text, { ...createTutorChatKeyboard() })
        } else {
          await ctx.reply(text, { ...createTutorChatKeyboard() })
        }
        return
      }

      // Find user in DB
      const user = await this.prisma.user.findUnique({
        where: { telegramId: BigInt(from.id) },
      })

      if (!user) {
        await ctx.reply(MESSAGES.ERROR_NOT_REGISTERED, { parse_mode: 'HTML' })
        return
      }

      await this.tutorChatService.startSession(user.id, telegramId)

      const text = MESSAGES.TUTOR_CHAT_STARTED
      if (isCallback) {
        await ctx.editMessageText(text, { ...createTutorChatKeyboard() })
      } else {
        await ctx.reply(text, { ...createTutorChatKeyboard() })
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to start tutor chat')
      await ctx.reply(MESSAGES.ERROR_GENERIC, { parse_mode: 'HTML' })
    }
  }

  @Action('tutor:stop')
  async onStopChat(@Ctx() ctx: Context) {
    try {
      const from = ctx.from
      if (!from) return

      await ctx.answerCbQuery('Чат завершён')

      await this.tutorChatService.endSession(from.id.toString())

      await ctx.editMessageText(MESSAGES.TUTOR_CHAT_ENDED, {
        ...createMainKeyboard(),
      })
    } catch (error) {
      this.logger.error({ error }, 'Failed to stop tutor chat')
      await ctx.answerCbQuery('Ошибка')
    }
  }

  /**
   * Handle text message when user is in tutor chat mode.
   * Called from QuizHandler before quiz answer processing.
   * Returns true if message was handled (user is in chat mode).
   */
  async handleTextInChatMode(ctx: Context): Promise<boolean> {
    const from = ctx.from
    if (!from || !('text' in ctx.message!)) return false

    const telegramId = from.id.toString()
    const isActive = await this.tutorChatService.isInChatMode(telegramId)
    if (!isActive) return false

    const text = (ctx.message as { text: string }).text

    try {
      // Show typing indicator
      await ctx.sendChatAction('typing')

      const response = await this.tutorChatService.sendMessage(telegramId, text)

      await ctx.reply(response.reply, { ...createTutorChatKeyboard() })
      return true
    } catch (error) {
      this.logger.error({ error, telegramId }, 'Failed to handle tutor chat message')
      await ctx.reply('Произошла ошибка. Попробуй ещё раз.', {
        ...createTutorChatKeyboard(),
      })
      return true
    }
  }
}
