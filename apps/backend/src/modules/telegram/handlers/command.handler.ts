import { Injectable } from '@nestjs/common'
import { Command, Update, Ctx } from 'nestjs-telegraf'
import { Context } from 'telegraf'
import { PinoLogger } from 'nestjs-pino'
import { LearningMode } from '@prisma/client'
import { PrismaService } from '../../../common/prisma/prisma.service'
import { MESSAGES, formatMessage } from '../constants/messages'
import { createBackToMenuKeyboard, createMainKeyboard } from '../keyboards/main.keyboard'
import { createSettingsKeyboard } from '../keyboards/settings.keyboard'

/**
 * Handler for basic bot commands
 */
@Update()
@Injectable()
export class CommandHandler {
  constructor(
    private readonly prisma: PrismaService,
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

      const user = await this.prisma.user.findUnique({
        where: { telegramId: BigInt(from.id) },
      })

      if (!user) {
        await ctx.reply(MESSAGES.ERROR_NOT_REGISTERED, { parse_mode: 'HTML' })
        return
      }

      const modeText = user.learningMode === LearningMode.ACTIVE ? 'Активен' : 'Пауза'
      const hoursText = user.preferredHours.map((h) => `${h}:00`).join(', ')

      const message = formatMessage(MESSAGES.SETTINGS_MENU, {
        wordsPerDay: user.newWordsPerDay,
        todayProgress: `${user.todayNewWordsCount}/${user.newWordsPerDay}`,
        mode: modeText,
        hours: hoursText,
      })

      await ctx.reply(message, {
        parse_mode: 'HTML',
        ...createSettingsKeyboard(user),
      })
    } catch (error) {
      this.logger.error({ error }, 'Failed to handle /settings command')
      await ctx.reply(MESSAGES.ERROR_GENERIC, { parse_mode: 'HTML' })
    }
  }
}
