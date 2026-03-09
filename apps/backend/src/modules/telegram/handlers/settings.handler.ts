import { Injectable } from '@nestjs/common'
import { Update, Ctx, Action } from 'nestjs-telegraf'
import { Context } from 'telegraf'
import { PinoLogger } from 'nestjs-pino'
import { LearningMode } from '@prisma/client'
import { PrismaService } from '../../../common/prisma/prisma.service'
import { MESSAGES, formatMessage } from '../constants/messages'
import { createSettingsKeyboard } from '../keyboards/settings.keyboard'

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

      const modeText = user.learningMode === LearningMode.ACTIVE ? 'Активен' : 'Пауза'
      const hoursText = user.preferredHours.map((h) => `${h}:00`).join(', ')

      const message = formatMessage(MESSAGES.SETTINGS_MENU, {
        wordsPerDay: user.newWordsPerDay,
        todayProgress: `${user.todayNewWordsCount}/${user.newWordsPerDay}`,
        mode: modeText,
        hours: hoursText,
      })

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

      const modeText = user.learningMode === LearningMode.ACTIVE ? 'Активен' : 'Пауза'
      const hoursText = user.preferredHours.map((h) => `${h}:00`).join(', ')

      const fullMessage = formatMessage(MESSAGES.SETTINGS_MENU, {
        wordsPerDay: user.newWordsPerDay,
        todayProgress: `${user.todayNewWordsCount}/${user.newWordsPerDay}`,
        mode: modeText,
        hours: hoursText,
      })

      await ctx.editMessageText(fullMessage, {
        parse_mode: 'HTML',
        ...createSettingsKeyboard(user),
      })

      this.logger.info({ telegramId: from.id, wordsPerDay }, 'User updated words per day')
    } catch (error) {
      this.logger.error({ error }, 'Failed to update words per day')
      await ctx.answerCbQuery('Ошибка')
    }
  }
}
