import { Injectable } from '@nestjs/common'
import { Update, Ctx, Action } from 'nestjs-telegraf'
import { Context } from 'telegraf'
import { PinoLogger } from 'nestjs-pino'
import { LearningMode } from '@prisma/client'
import { PrismaService } from '../../../common/prisma/prisma.service'
import { MESSAGES, formatMessage } from '../constants/messages'
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
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SettingsHandler.name)
  }

  @Action('settings:open')
  async onSettingsOpen(@Ctx() ctx: Context) {
    try {
      const from = ctx.from
      if (!from) return

      const user = await this.prisma.user.findUnique({
        where: { telegramId: BigInt(from.id) },
      })

      if (!user) {
        await ctx.answerCbQuery('Сначала нажми /start')
        return
      }

      await ctx.answerCbQuery()

      const message = this.formatSettingsMessage(user)

      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        ...createSettingsKeyboard(user),
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

      const user = await this.prisma.user.findUnique({
        where: { telegramId: BigInt(from.id) },
      })

      if (!user) {
        await ctx.answerCbQuery('Ошибка')
        return
      }

      await ctx.answerCbQuery()

      await ctx.editMessageText(MESSAGES.SETTINGS_TIMEZONE_SELECT, {
        parse_mode: 'HTML',
        ...createTimezoneKeyboard(user.timezone),
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

      const user = await this.prisma.user.update({
        where: { telegramId: BigInt(from.id) },
        data: { timezone },
      })

      await ctx.answerCbQuery(`Часовой пояс: ${timezone}`)

      await ctx.editMessageText(this.formatSettingsMessage(user), {
        parse_mode: 'HTML',
        ...createSettingsKeyboard(user),
      })

      this.logger.info({ telegramId: from.id, timezone }, 'User updated timezone')
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

      const user = await this.prisma.user.findUnique({
        where: { telegramId: BigInt(from.id) },
      })

      if (!user) {
        await ctx.answerCbQuery('Ошибка')
        return
      }

      await ctx.answerCbQuery()

      const message =
        user.pushIntervalMinutes === 0
          ? MESSAGES.SETTINGS_HOURS_SELECT
          : formatMessage(MESSAGES.SETTINGS_HOURS_RANGE, {
              start: user.activeHoursStart,
              end: user.activeHoursEnd,
            })

      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        ...createHoursKeyboard(user),
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

      const currentUser = await this.prisma.user.findUnique({
        where: { telegramId: BigInt(from.id) },
      })

      if (!currentUser) return

      let newHours: number[]
      if (currentUser.preferredHours.includes(hour)) {
        // Remove hour (but keep at least one)
        if (currentUser.preferredHours.length <= 1) {
          await ctx.answerCbQuery('Нужен хотя бы один час')
          return
        }
        newHours = currentUser.preferredHours.filter((h) => h !== hour)
      } else {
        // Add hour
        newHours = [...currentUser.preferredHours, hour].sort((a, b) => a - b)
      }

      const user = await this.prisma.user.update({
        where: { telegramId: BigInt(from.id) },
        data: { preferredHours: newHours },
      })

      await ctx.answerCbQuery()

      await ctx.editMessageText(MESSAGES.SETTINGS_HOURS_SELECT, {
        parse_mode: 'HTML',
        ...createHoursKeyboard(user),
      })

      this.logger.info({ telegramId: from.id, newHours }, 'User updated preferred hours')
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

      const user = await this.prisma.user.update({
        where: { telegramId: BigInt(from.id) },
        data: { activeHoursStart: hour },
      })

      await ctx.answerCbQuery(`Начало: ${hour}:00`)

      const message = formatMessage(MESSAGES.SETTINGS_HOURS_RANGE, {
        start: user.activeHoursStart,
        end: user.activeHoursEnd,
      })

      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        ...createHoursKeyboard(user),
      })

      this.logger.info({ telegramId: from.id, activeHoursStart: hour }, 'User updated start hour')
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

      const user = await this.prisma.user.update({
        where: { telegramId: BigInt(from.id) },
        data: { activeHoursEnd: hour },
      })

      await ctx.answerCbQuery(`Конец: ${hour}:00`)

      const message = formatMessage(MESSAGES.SETTINGS_HOURS_RANGE, {
        start: user.activeHoursStart,
        end: user.activeHoursEnd,
      })

      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        ...createHoursKeyboard(user),
      })

      this.logger.info({ telegramId: from.id, activeHoursEnd: hour }, 'User updated end hour')
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

      const user = await this.prisma.user.update({
        where: { telegramId: BigInt(from.id) },
        data: { learningMode: LearningMode.PAUSED },
      })

      await ctx.answerCbQuery('Обучение на паузе')

      const message = MESSAGES.SETTINGS_PAUSED

      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        ...createSettingsKeyboard(user),
      })

      this.logger.info({ telegramId: from.id }, 'User paused learning')
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

      const user = await this.prisma.user.update({
        where: { telegramId: BigInt(from.id) },
        data: { learningMode: LearningMode.ACTIVE },
      })

      await ctx.answerCbQuery('Обучение возобновлено')

      const message = formatMessage(MESSAGES.SETTINGS_RESUMED, {
        wordsPerDay: user.newWordsPerDay,
      })

      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        ...createSettingsKeyboard(user),
      })

      this.logger.info({ telegramId: from.id }, 'User resumed learning')
    } catch (error) {
      this.logger.error({ error }, 'Failed to resume learning')
      await ctx.answerCbQuery('Ошибка')
    }
  }

  private async updateWordsPerDay(ctx: Context, wordsPerDay: number) {
    try {
      const from = ctx.from
      if (!from) return

      const user = await this.prisma.user.update({
        where: { telegramId: BigInt(from.id) },
        data: { newWordsPerDay: wordsPerDay },
      })

      await ctx.answerCbQuery(`Установлено: ${wordsPerDay} слов в день`)

      await ctx.editMessageText(this.formatSettingsMessage(user), {
        parse_mode: 'HTML',
        ...createSettingsKeyboard(user),
      })

      this.logger.info({ telegramId: from.id, wordsPerDay }, 'User updated words per day')
    } catch (error) {
      this.logger.error({ error }, 'Failed to update words per day')
      await ctx.answerCbQuery('Ошибка')
    }
  }

  private async updatePushInterval(ctx: Context, intervalMinutes: number) {
    try {
      const from = ctx.from
      if (!from) return

      const user = await this.prisma.user.update({
        where: { telegramId: BigInt(from.id) },
        data: { pushIntervalMinutes: intervalMinutes },
      })

      const intervalText = this.formatIntervalText(intervalMinutes)
      await ctx.answerCbQuery(`Интервал: ${intervalText}`)

      await ctx.editMessageText(this.formatSettingsMessage(user), {
        parse_mode: 'HTML',
        ...createSettingsKeyboard(user),
      })

      this.logger.info({ telegramId: from.id, intervalMinutes }, 'User updated push interval')
    } catch (error) {
      this.logger.error({ error }, 'Failed to update push interval')
      await ctx.answerCbQuery('Ошибка')
    }
  }

  private formatIntervalText(minutes: number): string {
    if (minutes === 0) return 'выкл'
    if (minutes === 5) return 'каждые 5 мин'
    if (minutes === 10) return 'каждые 10 мин'
    if (minutes === 60) return 'каждый час'
    return `${minutes} мин`
  }

  private formatSettingsMessage(user: {
    newWordsPerDay: number
    todayNewWordsCount: number
    learningMode: LearningMode
    pushIntervalMinutes: number
    preferredHours: number[]
    activeHoursStart: number
    activeHoursEnd: number
    timezone: string | null
  }): string {
    const modeText = user.learningMode === LearningMode.ACTIVE ? 'Активен' : 'Пауза'
    const todayProgress = `${user.todayNewWordsCount}/${user.newWordsPerDay}`

    let intervalText: string
    if (user.pushIntervalMinutes === 0) {
      intervalText = `в ${user.preferredHours.join(', ')}:00`
    } else {
      intervalText = this.formatIntervalText(user.pushIntervalMinutes)
    }

    const timezoneText = this.formatTimezoneText(user.timezone)

    return formatMessage(MESSAGES.SETTINGS_MENU, {
      wordsPerDay: user.newWordsPerDay,
      todayProgress,
      mode: modeText,
      interval: intervalText,
      timezone: timezoneText,
    })
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
