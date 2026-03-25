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

// Single source of truth for timezones
export const TIMEZONES = [
  { id: 'Europe/Moscow', label: 'Москва (UTC+3)', short: 'MSK' },
  { id: 'Europe/Kaliningrad', label: 'Калининград (UTC+2)', short: 'UTC+2' },
  { id: 'Europe/Samara', label: 'Самара (UTC+4)', short: 'UTC+4' },
  { id: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)', short: 'UTC+5' },
  { id: 'Asia/Novosibirsk', label: 'Новосибирск (UTC+7)', short: 'UTC+7' },
  { id: 'Asia/Vladivostok', label: 'Владивосток (UTC+10)', short: 'UTC+10' },
  { id: 'Europe/Tbilisi', label: 'Тбилиси (UTC+4)', short: 'TBS' },
  { id: 'Europe/Kiev', label: 'Киев (UTC+2)', short: 'UTC+2' },
  { id: 'Asia/Almaty', label: 'Алматы (UTC+6)', short: 'UTC+6' },
]

export const VALID_TIMEZONE_IDS = TIMEZONES.map((t) => t.id)

export function formatTimezoneShort(tz: string | null): string {
  const found = TIMEZONES.find((t) => t.id === tz)
  return found ? found.short : 'MSK'
}

export function formatTimezoneLabel(tz: string | null): string {
  const found = TIMEZONES.find((t) => t.id === (tz || 'Europe/Moscow'))
  return found ? found.label : 'Москва (UTC+3)'
}

// Validation constants
const VALID_QUIZ_COUNTS = [5, 10, 15]
const VALID_WORDS_PER_DAY = [10, 20, 30]
const VALID_PUSH_INTERVALS = [0, 5, 10, 60]
const VALID_HOURS_RANGE = { min: 0, max: 23 }

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
    if (!VALID_QUIZ_COUNTS.includes(count)) {
      throw new Error(
        `Invalid quiz words count: ${count}. Allowed: ${VALID_QUIZ_COUNTS.join(', ')}`,
      )
    }

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
    if (!VALID_WORDS_PER_DAY.includes(wordsPerDay)) {
      throw new Error(
        `Invalid words per day: ${wordsPerDay}. Allowed: ${VALID_WORDS_PER_DAY.join(', ')}`,
      )
    }

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
    if (!VALID_PUSH_INTERVALS.includes(intervalMinutes)) {
      throw new Error(
        `Invalid push interval: ${intervalMinutes}. Allowed: ${VALID_PUSH_INTERVALS.join(', ')}`,
      )
    }

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
    if (!VALID_TIMEZONE_IDS.includes(timezone)) {
      throw new Error(`Invalid timezone: ${timezone}. Allowed: ${VALID_TIMEZONE_IDS.join(', ')}`)
    }

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
    if (hour < VALID_HOURS_RANGE.min || hour > VALID_HOURS_RANGE.max) {
      throw new Error(
        `Invalid hour: ${hour}. Must be ${VALID_HOURS_RANGE.min}-${VALID_HOURS_RANGE.max}`,
      )
    }

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
    if (hour < VALID_HOURS_RANGE.min || hour > VALID_HOURS_RANGE.max) {
      throw new Error(
        `Invalid hour: ${hour}. Must be ${VALID_HOURS_RANGE.min}-${VALID_HOURS_RANGE.max}`,
      )
    }

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

    const timezoneText = formatTimezoneLabel(user.timezone)

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
}
