import { Injectable } from '@nestjs/common'
import { Update, Ctx, Action } from 'nestjs-telegraf'
import { Context } from 'telegraf'
import { PinoLogger } from 'nestjs-pino'
import { MESSAGES } from '../constants/messages'
import { SettingsService } from '../services/settings.service'
import {
  createSettingsKeyboard,
  createHoursKeyboard,
  createTimezoneKeyboard,
} from '../keyboards/settings.keyboard'

/**
 * Handler for /settings command and settings actions
 */
@Update()
@Injectable()
export class SettingsHandler {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SettingsHandler.name)
  }

  @Action('settings:open')
  async onSettingsOpen(@Ctx() ctx: Context) {
    try {
      const from = ctx.from
      if (!from) return

      const result = await this.settingsService.getSettings(BigInt(from.id))

      if (!result) {
        await ctx.answerCbQuery('Сначала нажми /start')
        return
      }

      await ctx.answerCbQuery()

      await ctx.editMessageText(result.message, {
        parse_mode: 'HTML',
        ...createSettingsKeyboard(result.user),
      })
    } catch (error) {
      this.logger.error({ error }, 'Failed to open settings')
      await ctx.answerCbQuery('Ошибка')
    }
  }

  @Action('settings:words:10')
  async onSetWords10(@Ctx() ctx: Context) {
    await this.updateWordsPerDay(ctx, 10)
  }

  @Action('settings:words:20')
  async onSetWords20(@Ctx() ctx: Context) {
    await this.updateWordsPerDay(ctx, 20)
  }

  @Action('settings:words:30')
  async onSetWords30(@Ctx() ctx: Context) {
    await this.updateWordsPerDay(ctx, 30)
  }

  @Action('settings:quiz:5')
  async onSetQuiz5(@Ctx() ctx: Context) {
    await this.updateQuizWordsCount(ctx, 5)
  }

  @Action('settings:quiz:10')
  async onSetQuiz10(@Ctx() ctx: Context) {
    await this.updateQuizWordsCount(ctx, 10)
  }

  @Action('settings:quiz:15')
  async onSetQuiz15(@Ctx() ctx: Context) {
    await this.updateQuizWordsCount(ctx, 15)
  }

  @Action('settings:interval:0')
  async onSetIntervalOff(@Ctx() ctx: Context) {
    await this.updatePushInterval(ctx, 0)
  }

  @Action('settings:interval:5')
  async onSetInterval5(@Ctx() ctx: Context) {
    await this.updatePushInterval(ctx, 5)
  }

  @Action('settings:interval:10')
  async onSetInterval10(@Ctx() ctx: Context) {
    await this.updatePushInterval(ctx, 10)
  }

  @Action('settings:interval:60')
  async onSetInterval60(@Ctx() ctx: Context) {
    await this.updatePushInterval(ctx, 60)
  }

  @Action('settings:timezone:menu')
  async onTimezoneMenu(@Ctx() ctx: Context) {
    try {
      const from = ctx.from
      if (!from) return

      const result = await this.settingsService.getSettings(BigInt(from.id))

      if (!result) {
        await ctx.answerCbQuery('Ошибка')
        return
      }

      await ctx.answerCbQuery()

      await ctx.editMessageText(MESSAGES.SETTINGS_TIMEZONE_SELECT, {
        parse_mode: 'HTML',
        ...createTimezoneKeyboard(result.user.timezone),
      })
    } catch (error) {
      this.logger.error({ error }, 'Failed to show timezone menu')
      await ctx.answerCbQuery('Ошибка')
    }
  }

  @Action(/^settings:timezone:(.+)$/)
  async onSetTimezone(@Ctx() ctx: Context) {
    try {
      const from = ctx.from
      if (!from) return

      const callbackData = 'data' in ctx.callbackQuery! ? ctx.callbackQuery.data : ''
      const match = callbackData.match(/^settings:timezone:(.+)$/)
      if (!match) return

      const timezone = match[1]
      if (timezone === 'menu') return // Already handled by onTimezoneMenu

      const result = await this.settingsService.updateTimezone(BigInt(from.id), timezone)

      await ctx.answerCbQuery(`Часовой пояс: ${timezone}`)

      await ctx.editMessageText(result.message, {
        parse_mode: 'HTML',
        ...createSettingsKeyboard(result.user),
      })
    } catch (error) {
      this.logger.error({ error }, 'Failed to update timezone')
      await ctx.answerCbQuery('Ошибка')
    }
  }

  @Action('settings:hours:menu')
  async onHoursMenu(@Ctx() ctx: Context) {
    try {
      const from = ctx.from
      if (!from) return

      const result = await this.settingsService.getSettings(BigInt(from.id))

      if (!result) {
        await ctx.answerCbQuery('Ошибка')
        return
      }

      await ctx.answerCbQuery()

      const message =
        result.user.pushIntervalMinutes === 0
          ? MESSAGES.SETTINGS_HOURS_SELECT
          : `⏰ <b>Активные часы</b>\n\nУведомления будут приходить с <b>${result.user.activeHoursStart}:00</b> до <b>${result.user.activeHoursEnd}:00</b>.\n\nВыбери время начала и окончания:`

      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        ...createHoursKeyboard(result.user),
      })
    } catch (error) {
      this.logger.error({ error }, 'Failed to show hours menu')
      await ctx.answerCbQuery('Ошибка')
    }
  }

  @Action(/^settings:hours:toggle:(\d+)$/)
  async onToggleHour(@Ctx() ctx: Context) {
    try {
      const from = ctx.from
      if (!from) return

      const callbackData = 'data' in ctx.callbackQuery! ? ctx.callbackQuery.data : ''
      const match = callbackData.match(/^settings:hours:toggle:(\d+)$/)
      if (!match) return

      const hour = parseInt(match[1], 10)

      const currentResult = await this.settingsService.getSettings(BigInt(from.id))
      if (!currentResult) return

      let newHours: number[]
      if (currentResult.user.preferredHours.includes(hour)) {
        // Remove hour (but keep at least one)
        if (currentResult.user.preferredHours.length <= 1) {
          await ctx.answerCbQuery('Нужен хотя бы один час')
          return
        }
        newHours = currentResult.user.preferredHours.filter((h) => h !== hour)
      } else {
        // Add hour
        newHours = [...currentResult.user.preferredHours, hour].sort((a, b) => a - b)
      }

      const result = await this.settingsService.updatePreferredHours(BigInt(from.id), newHours)

      await ctx.answerCbQuery()

      await ctx.editMessageText(MESSAGES.SETTINGS_HOURS_SELECT, {
        parse_mode: 'HTML',
        ...createHoursKeyboard(result.user),
      })
    } catch (error) {
      this.logger.error({ error }, 'Failed to toggle hour')
      await ctx.answerCbQuery('Ошибка')
    }
  }

  @Action(/^settings:hours:start:(\d+)$/)
  async onSetStartHour(@Ctx() ctx: Context) {
    try {
      const from = ctx.from
      if (!from) return

      const callbackData = 'data' in ctx.callbackQuery! ? ctx.callbackQuery.data : ''
      const match = callbackData.match(/^settings:hours:start:(\d+)$/)
      if (!match) return

      const hour = parseInt(match[1], 10)

      const result = await this.settingsService.updateActiveHoursStart(BigInt(from.id), hour)

      await ctx.answerCbQuery(`Начало: ${hour}:00`)

      const message = `⏰ <b>Активные часы</b>\n\nУведомления будут приходить с <b>${result.user.activeHoursStart}:00</b> до <b>${result.user.activeHoursEnd}:00</b>.\n\nВыбери время начала и окончания:`

      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        ...createHoursKeyboard(result.user),
      })
    } catch (error) {
      this.logger.error({ error }, 'Failed to set start hour')
      await ctx.answerCbQuery('Ошибка')
    }
  }

  @Action(/^settings:hours:end:(\d+)$/)
  async onSetEndHour(@Ctx() ctx: Context) {
    try {
      const from = ctx.from
      if (!from) return

      const callbackData = 'data' in ctx.callbackQuery! ? ctx.callbackQuery.data : ''
      const match = callbackData.match(/^settings:hours:end:(\d+)$/)
      if (!match) return

      const hour = parseInt(match[1], 10)

      const result = await this.settingsService.updateActiveHoursEnd(BigInt(from.id), hour)

      await ctx.answerCbQuery(`Конец: ${hour}:00`)

      const message = `⏰ <b>Активные часы</b>\n\nУведомления будут приходить с <b>${result.user.activeHoursStart}:00</b> до <b>${result.user.activeHoursEnd}:00</b>.\n\nВыбери время начала и окончания:`

      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        ...createHoursKeyboard(result.user),
      })
    } catch (error) {
      this.logger.error({ error }, 'Failed to set end hour')
      await ctx.answerCbQuery('Ошибка')
    }
  }

  @Action('noop')
  async onNoop(@Ctx() ctx: Context) {
    await ctx.answerCbQuery()
  }

  @Action('settings:pause')
  async onPause(@Ctx() ctx: Context) {
    try {
      const from = ctx.from
      if (!from) return

      const result = await this.settingsService.pauseLearning(BigInt(from.id))

      await ctx.answerCbQuery('Обучение на паузе')

      await ctx.editMessageText(result.message, {
        parse_mode: 'HTML',
        ...createSettingsKeyboard(result.user),
      })
    } catch (error) {
      this.logger.error({ error }, 'Failed to pause learning')
      await ctx.answerCbQuery('Ошибка')
    }
  }

  @Action('settings:resume')
  async onResume(@Ctx() ctx: Context) {
    try {
      const from = ctx.from
      if (!from) return

      const result = await this.settingsService.resumeLearning(BigInt(from.id))

      await ctx.answerCbQuery('Обучение возобновлено')

      await ctx.editMessageText(result.message, {
        parse_mode: 'HTML',
        ...createSettingsKeyboard(result.user),
      })
    } catch (error) {
      this.logger.error({ error }, 'Failed to resume learning')
      await ctx.answerCbQuery('Ошибка')
    }
  }

  private async updateWordsPerDay(ctx: Context, wordsPerDay: number) {
    try {
      const from = ctx.from
      if (!from) return

      const result = await this.settingsService.updateWordsPerDay(BigInt(from.id), wordsPerDay)

      await ctx.answerCbQuery(`Установлено: ${wordsPerDay} слов в день`)

      await ctx.editMessageText(result.message, {
        parse_mode: 'HTML',
        ...createSettingsKeyboard(result.user),
      })
    } catch (error) {
      this.logger.error({ error }, 'Failed to update words per day')
      await ctx.answerCbQuery('Ошибка')
    }
  }

  private async updatePushInterval(ctx: Context, intervalMinutes: number) {
    try {
      const from = ctx.from
      if (!from) return

      const result = await this.settingsService.updatePushInterval(BigInt(from.id), intervalMinutes)

      const intervalText =
        intervalMinutes === 0 ? 'Часы' : intervalMinutes === 60 ? '1ч' : `${intervalMinutes}м`
      await ctx.answerCbQuery(`Интервал: ${intervalText}`)

      await ctx.editMessageText(result.message, {
        parse_mode: 'HTML',
        ...createSettingsKeyboard(result.user),
      })
    } catch (error) {
      this.logger.error({ error }, 'Failed to update push interval')
      await ctx.answerCbQuery('Ошибка')
    }
  }

  private async updateQuizWordsCount(ctx: Context, count: number) {
    try {
      const from = ctx.from
      if (!from) return

      const result = await this.settingsService.updateQuizWordsCount(BigInt(from.id), count)

      await ctx.answerCbQuery(`Установлено: ${count} слов в квизе`)

      await ctx.editMessageText(result.message, {
        parse_mode: 'HTML',
        ...createSettingsKeyboard(result.user),
      })
    } catch (error) {
      this.logger.error({ error }, 'Failed to update quiz words count')
      await ctx.answerCbQuery('Ошибка')
    }
  }
}
