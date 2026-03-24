import { Injectable } from '@nestjs/common'
import { Command, Update, Ctx } from 'nestjs-telegraf'
import { Context } from 'telegraf'
import { PinoLogger } from 'nestjs-pino'
import { MESSAGES } from '../constants/messages'
import { createBackToMenuKeyboard, createMainKeyboard } from '../keyboards/main.keyboard'
import { createSettingsKeyboard } from '../keyboards/settings.keyboard'
import { SettingsService } from '../services/settings.service'

/**
 * Handler for basic bot commands
 */
@Update()
@Injectable()
export class CommandHandler {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly logger: PinoLogger,
  ) {
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
      const from = ctx.from
      if (!from) {
        await ctx.reply(MESSAGES.ERROR_NOT_REGISTERED, { parse_mode: 'HTML' })
        return
      }

      const result = await this.settingsService.getSettings(BigInt(from.id))

      if (!result) {
        await ctx.reply(MESSAGES.ERROR_NOT_REGISTERED, { parse_mode: 'HTML' })
        return
      }

      await ctx.reply(result.message, {
        parse_mode: 'HTML',
        ...createSettingsKeyboard(result.user),
      })
    } catch (error) {
      this.logger.error({ error }, 'Failed to handle /settings command')
      await ctx.reply(MESSAGES.ERROR_GENERIC, { parse_mode: 'HTML' })
    }
  }
}
