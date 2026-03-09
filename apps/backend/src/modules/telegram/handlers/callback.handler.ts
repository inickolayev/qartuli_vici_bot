import { Injectable } from '@nestjs/common'
import { Update, Ctx, Action } from 'nestjs-telegraf'
import { Context } from 'telegraf'
import { PinoLogger } from 'nestjs-pino'
import { MESSAGES, formatMessage } from '../constants/messages'
import { createMainKeyboard, createBackToMenuKeyboard } from '../keyboards/main.keyboard'

/**
 * Handler for inline keyboard callbacks
 */
@Update()
@Injectable()
export class CallbackHandler {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(CallbackHandler.name)
  }

  @Action('menu:main')
  async onMainMenu(@Ctx() ctx: Context) {
    try {
      if (!ctx.from) return

      const firstName = ctx.from.first_name || 'друг'
      const welcomeMessage = formatMessage(MESSAGES.WELCOME, { firstName })

      await ctx.editMessageText(welcomeMessage, {
        parse_mode: 'HTML',
        ...createMainKeyboard(),
      })

      await ctx.answerCbQuery()
    } catch (error) {
      this.logger.error({ error }, 'Failed to show main menu')
      await ctx.answerCbQuery(MESSAGES.ERROR_GENERIC)
    }
  }

  @Action('menu:close')
  async onCloseMenu(@Ctx() ctx: Context) {
    try {
      await ctx.deleteMessage()
      await ctx.answerCbQuery()
    } catch (error) {
      this.logger.error({ error }, 'Failed to close menu')
      await ctx.answerCbQuery()
    }
  }

  // quiz:start is handled by QuizHandler
  // stats:show is handled by StatsHandler

  @Action('streak:show')
  async onStreakShow(@Ctx() ctx: Context) {
    try {
      this.logger.info('User clicked streak:show (placeholder)')

      await ctx.editMessageText(MESSAGES.PLACEHOLDER_STREAK, {
        parse_mode: 'HTML',
        ...createBackToMenuKeyboard(),
      })

      await ctx.answerCbQuery()
    } catch (error) {
      this.logger.error({ error }, 'Failed to handle streak:show')
      await ctx.answerCbQuery(MESSAGES.ERROR_GENERIC)
    }
  }

  @Action('achievements:show')
  async onAchievementsShow(@Ctx() ctx: Context) {
    try {
      this.logger.info('User clicked achievements:show (placeholder)')

      await ctx.editMessageText(MESSAGES.PLACEHOLDER_ACHIEVEMENTS, {
        parse_mode: 'HTML',
        ...createBackToMenuKeyboard(),
      })

      await ctx.answerCbQuery()
    } catch (error) {
      this.logger.error({ error }, 'Failed to handle achievements:show')
      await ctx.answerCbQuery(MESSAGES.ERROR_GENERIC)
    }
  }

  @Action('collections:list')
  async onCollectionsList(@Ctx() ctx: Context) {
    try {
      this.logger.info('User clicked collections:list (placeholder)')

      await ctx.editMessageText(MESSAGES.PLACEHOLDER_COLLECTIONS, {
        parse_mode: 'HTML',
        ...createBackToMenuKeyboard(),
      })

      await ctx.answerCbQuery()
    } catch (error) {
      this.logger.error({ error }, 'Failed to handle collections:list')
      await ctx.answerCbQuery(MESSAGES.ERROR_GENERIC)
    }
  }

  // settings:open is handled by SettingsHandler
}
