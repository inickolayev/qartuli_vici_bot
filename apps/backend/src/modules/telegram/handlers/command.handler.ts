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

      let intervalText: string
      if (user.pushIntervalMinutes === 0) {
        intervalText = `в ${user.preferredHours.join(', ')}:00`
      } else if (user.pushIntervalMinutes === 5) {
        intervalText = 'каждые 5 мин'
      } else if (user.pushIntervalMinutes === 10) {
        intervalText = 'каждые 10 мин'
      } else if (user.pushIntervalMinutes === 60) {
        intervalText = 'каждый час'
      } else {
        intervalText = `${user.pushIntervalMinutes} мин`
      }

      const timezoneText = this.formatTimezoneText(user.timezone)

      const message = formatMessage(MESSAGES.SETTINGS_MENU, {
        wordsPerDay: user.newWordsPerDay,
        todayProgress: `${user.todayNewWordsCount}/${user.newWordsPerDay}`,
        mode: modeText,
        interval: intervalText,
        timezone: timezoneText,
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

  private formatTimezoneText(tz: string | null): string {
    const timezones: Record<string, string> = {
      'Europe/Moscow': 'Москва (UTC+3)',
      'Europe/Kaliningrad': 'Калининград (UTC+2)',
      'Europe/Samara': 'Самара (UTC+4)',
      'Asia/Yekaterinburg': 'Екатеринбург (UTC+5)',
      'Asia/Novosibirsk': 'Новосибирск (UTC+7)',
      'Asia/Vladivostok': 'Владивосток (UTC+10)',
      'Europe/Tbilisi': 'Тбилиси (UTC+4)',
      'Europe/Kiev': 'Киев (UTC+2)',
      'Asia/Almaty': 'Алматы (UTC+6)',
    }
    return timezones[tz || 'Europe/Moscow'] || 'Москва (UTC+3)'
  }
}
