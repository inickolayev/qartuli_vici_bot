import { Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { LearningMode } from '@prisma/client'
import { PrismaService } from '../../../common/prisma/prisma.service'
import { MESSAGES, formatMessage } from '../constants/messages'

export interface UserSettings {
  newWordsPerDay: number
  todayNewWordsCount: number
  learningMode: LearningMode
  pushIntervalMinutes: number
  preferredHours: number[]
  activeHoursStart: number
  activeHoursEnd: number
  timezone: string | null
  quizWordsCount: number
}

export interface SettingsResponse {
  message: string
  user: UserSettings
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SettingsService.name)
  }

  async getSettings(telegramId: bigint): Promise<SettingsResponse | null> {
    const user = await this.prisma.user.findUnique({
      where: { telegramId },
    })

    if (!user) {
      return null
    }

    return {
      message: this.formatSettingsMessage(user),
      user,
    }
  }

  async updateQuizWordsCount(telegramId: bigint, count: number): Promise<SettingsResponse> {
    const user = await this.prisma.user.update({
      where: { telegramId },
      data: { quizWordsCount: count },
    })

    this.logger.info(
      { telegramId: telegramId.toString(), quizWordsCount: count },
      'User updated quiz words count',
    )

    return {
      message: this.formatSettingsMessage(user),
      user,
    }
  }

  async updateWordsPerDay(telegramId: bigint, wordsPerDay: number): Promise<SettingsResponse> {
    const user = await this.prisma.user.update({
      where: { telegramId },
      data: { newWordsPerDay: wordsPerDay },
    })

    this.logger.info(
      { telegramId: telegramId.toString(), wordsPerDay },
      'User updated words per day',
    )

    return {
      message: this.formatSettingsMessage(user),
      user,
    }
  }

  async updatePushInterval(telegramId: bigint, intervalMinutes: number): Promise<SettingsResponse> {
    const user = await this.prisma.user.update({
      where: { telegramId },
      data: { pushIntervalMinutes: intervalMinutes },
    })

    this.logger.info(
      { telegramId: telegramId.toString(), intervalMinutes },
      'User updated push interval',
    )

    return {
      message: this.formatSettingsMessage(user),
      user,
    }
  }

  async updateTimezone(telegramId: bigint, timezone: string): Promise<SettingsResponse> {
    const user = await this.prisma.user.update({
      where: { telegramId },
      data: { timezone },
    })

    this.logger.info({ telegramId: telegramId.toString(), timezone }, 'User updated timezone')

    return {
      message: this.formatSettingsMessage(user),
      user,
    }
  }

  async updatePreferredHours(telegramId: bigint, hours: number[]): Promise<SettingsResponse> {
    const user = await this.prisma.user.update({
      where: { telegramId },
      data: { preferredHours: hours },
    })

    this.logger.info(
      { telegramId: telegramId.toString(), preferredHours: hours },
      'User updated preferred hours',
    )

    return {
      message: this.formatSettingsMessage(user),
      user,
    }
  }

  async updateActiveHoursStart(telegramId: bigint, hour: number): Promise<SettingsResponse> {
    const user = await this.prisma.user.update({
      where: { telegramId },
      data: { activeHoursStart: hour },
    })

    this.logger.info(
      { telegramId: telegramId.toString(), activeHoursStart: hour },
      'User updated start hour',
    )

    return {
      message: this.formatSettingsMessage(user),
      user,
    }
  }

  async updateActiveHoursEnd(telegramId: bigint, hour: number): Promise<SettingsResponse> {
    const user = await this.prisma.user.update({
      where: { telegramId },
      data: { activeHoursEnd: hour },
    })

    this.logger.info(
      { telegramId: telegramId.toString(), activeHoursEnd: hour },
      'User updated end hour',
    )

    return {
      message: this.formatSettingsMessage(user),
      user,
    }
  }

  async pauseLearning(telegramId: bigint): Promise<SettingsResponse> {
    const user = await this.prisma.user.update({
      where: { telegramId },
      data: { learningMode: LearningMode.PAUSED },
    })

    this.logger.info({ telegramId: telegramId.toString() }, 'User paused learning')

    return {
      message: MESSAGES.SETTINGS_PAUSED,
      user,
    }
  }

  async resumeLearning(telegramId: bigint): Promise<SettingsResponse> {
    const user = await this.prisma.user.update({
      where: { telegramId },
      data: { learningMode: LearningMode.ACTIVE },
    })

    this.logger.info({ telegramId: telegramId.toString() }, 'User resumed learning')

    return {
      message: formatMessage(MESSAGES.SETTINGS_RESUMED, {
        wordsPerDay: user.newWordsPerDay,
      }),
      user,
    }
  }

  formatSettingsMessage(user: UserSettings): string {
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
      quizWordsCount: user.quizWordsCount,
      todayProgress,
      mode: modeText,
      interval: intervalText,
      timezone: timezoneText,
    })
  }

  private formatIntervalText(minutes: number): string {
    if (minutes === 0) return 'выкл'
    if (minutes === 5) return 'каждые 5 мин'
    if (minutes === 10) return 'каждые 10 мин'
    if (minutes === 60) return 'каждый час'
    return `${minutes} мин`
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
