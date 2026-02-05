import { Injectable } from '@nestjs/common'
import { Command, Update, Ctx } from 'nestjs-telegraf'
import { Context } from 'telegraf'
import { PinoLogger } from 'nestjs-pino'
import { MESSAGES } from '../constants/messages'
import { createBackToMenuKeyboard, createMainKeyboard } from '../keyboards/main.keyboard'

/**
 * Handler for basic bot commands
 */
@Update()
@Injectable()
export class CommandHandler {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(CommandHandler.name)
  }

  @Command('help')
  async onHelp(@Ctx() ctx: Context) {
    try {
      await ctx.reply(MESSAGES.HELP, {
        parse_mode: 'HTML',
        ...createMainKeyboard(),
      })
    } catch (error) {
      this.logger.error({ error }, 'Failed to handle /help command')
      await ctx.reply(MESSAGES.ERROR_GENERIC, { parse_mode: 'HTML' })
    }
  }

  @Command('quiz')
  async onQuiz(@Ctx() ctx: Context) {
    try {
      this.logger.info('User requested quiz (placeholder)')
      await ctx.reply(MESSAGES.PLACEHOLDER_QUIZ, {
        parse_mode: 'HTML',
        ...createBackToMenuKeyboard(),
      })
    } catch (error) {
      this.logger.error({ error }, 'Failed to handle /quiz command')
      await ctx.reply(MESSAGES.ERROR_GENERIC, { parse_mode: 'HTML' })
    }
  }

  @Command('stats')
  async onStats(@Ctx() ctx: Context) {
    try {
      this.logger.info('User requested stats (placeholder)')
      await ctx.reply(MESSAGES.PLACEHOLDER_STATS, {
        parse_mode: 'HTML',
        ...createBackToMenuKeyboard(),
      })
    } catch (error) {
      this.logger.error({ error }, 'Failed to handle /stats command')
      await ctx.reply(MESSAGES.ERROR_GENERIC, { parse_mode: 'HTML' })
    }
  }

  @Command('streak')
  async onStreak(@Ctx() ctx: Context) {
    try {
      this.logger.info('User requested streak (placeholder)')
      await ctx.reply(MESSAGES.PLACEHOLDER_STREAK, {
        parse_mode: 'HTML',
        ...createBackToMenuKeyboard(),
      })
    } catch (error) {
      this.logger.error({ error }, 'Failed to handle /streak command')
      await ctx.reply(MESSAGES.ERROR_GENERIC, { parse_mode: 'HTML' })
    }
  }

  @Command('achievements')
  async onAchievements(@Ctx() ctx: Context) {
    try {
      this.logger.info('User requested achievements (placeholder)')
      await ctx.reply(MESSAGES.PLACEHOLDER_ACHIEVEMENTS, {
        parse_mode: 'HTML',
        ...createBackToMenuKeyboard(),
      })
    } catch (error) {
      this.logger.error({ error }, 'Failed to handle /achievements command')
      await ctx.reply(MESSAGES.ERROR_GENERIC, { parse_mode: 'HTML' })
    }
  }

  @Command('collections')
  async onCollections(@Ctx() ctx: Context) {
    try {
      this.logger.info('User requested collections (placeholder)')
      await ctx.reply(MESSAGES.PLACEHOLDER_COLLECTIONS, {
        parse_mode: 'HTML',
        ...createBackToMenuKeyboard(),
      })
    } catch (error) {
      this.logger.error({ error }, 'Failed to handle /collections command')
      await ctx.reply(MESSAGES.ERROR_GENERIC, { parse_mode: 'HTML' })
    }
  }

  @Command('settings')
  async onSettings(@Ctx() ctx: Context) {
    try {
      this.logger.info('User requested settings (placeholder)')
      await ctx.reply(MESSAGES.PLACEHOLDER_SETTINGS, {
        parse_mode: 'HTML',
        ...createBackToMenuKeyboard(),
      })
    } catch (error) {
      this.logger.error({ error }, 'Failed to handle /settings command')
      await ctx.reply(MESSAGES.ERROR_GENERIC, { parse_mode: 'HTML' })
    }
  }
}
