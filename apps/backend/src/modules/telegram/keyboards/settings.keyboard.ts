import { LearningMode } from '@prisma/client'
import { KeyboardLayout, toTelegrafKeyboard } from './types'

// Common timezones for users
const TIMEZONES = [
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

function formatTimezone(tz: string | null): string {
  const found = TIMEZONES.find((t) => t.id === tz)
  return found ? found.short : 'MSK'
}

export interface UserSettings {
  newWordsPerDay: number
  learningMode: LearningMode
  pushIntervalMinutes: number
  preferredHours: number[]
  activeHoursStart: number
  activeHoursEnd: number
  timezone: string | null
  quizWordsCount: number
}

/**
 * Create settings menu keyboard layout (neutral format)
 */
export function createSettingsKeyboardLayout(user: UserSettings): KeyboardLayout {
  const isPaused = user.learningMode === LearningMode.PAUSED

  return [
    // Words per day row
    [
      { text: user.newWordsPerDay === 10 ? '✓ 10' : '10', callbackData: 'settings:words:10' },
      { text: user.newWordsPerDay === 20 ? '✓ 20' : '20', callbackData: 'settings:words:20' },
      { text: user.newWordsPerDay === 30 ? '✓ 30' : '30', callbackData: 'settings:words:30' },
      { text: 'слов/день', callbackData: 'noop' },
    ],
    // Quiz words count row
    [
      { text: user.quizWordsCount === 5 ? '✓ 5' : '5', callbackData: 'settings:quiz:5' },
      { text: user.quizWordsCount === 10 ? '✓ 10' : '10', callbackData: 'settings:quiz:10' },
      { text: user.quizWordsCount === 15 ? '✓ 15' : '15', callbackData: 'settings:quiz:15' },
      { text: 'слов/квиз', callbackData: 'noop' },
    ],
    // Push interval row
    [
      {
        text: user.pushIntervalMinutes === 0 ? '✓ Часы' : 'Часы',
        callbackData: 'settings:interval:0',
      },
      {
        text: user.pushIntervalMinutes === 60 ? '✓ 1ч' : '1ч',
        callbackData: 'settings:interval:60',
      },
      {
        text: user.pushIntervalMinutes === 10 ? '✓ 10м' : '10м',
        callbackData: 'settings:interval:10',
      },
      { text: user.pushIntervalMinutes === 5 ? '✓ 5м' : '5м', callbackData: 'settings:interval:5' },
    ],
    // Configure hours button
    [{ text: '⏰ Настроить время', callbackData: 'settings:hours:menu' }],
    // Timezone button
    [
      {
        text: `🌍 Часовой пояс: ${formatTimezone(user.timezone)}`,
        callbackData: 'settings:timezone:menu',
      },
    ],
    // Pause/Resume row
    [
      isPaused
        ? { text: '▶️ Возобновить обучение', callbackData: 'settings:resume' }
        : { text: '⏸ Поставить на паузу', callbackData: 'settings:pause' },
    ],
    // Back row
    [{ text: '« Назад', callbackData: 'menu:main' }],
  ]
}

/**
 * Create settings menu keyboard (Telegraf format)
 */
export function createSettingsKeyboard(user: UserSettings) {
  return toTelegrafKeyboard(createSettingsKeyboardLayout(user))
}

/**
 * Create hours configuration keyboard layout (neutral format)
 */
export function createHoursKeyboardLayout(user: UserSettings): KeyboardLayout {
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]

  if (user.pushIntervalMinutes === 0) {
    // Mode: specific hours - toggle each hour
    const row1 = hours.slice(0, 5).map((h) => ({
      text: user.preferredHours.includes(h) ? `✓${h}` : `${h}`,
      callbackData: `settings:hours:toggle:${h}`,
    }))
    const row2 = hours.slice(5, 10).map((h) => ({
      text: user.preferredHours.includes(h) ? `✓${h}` : `${h}`,
      callbackData: `settings:hours:toggle:${h}`,
    }))
    const row3 = hours.slice(10).map((h) => ({
      text: user.preferredHours.includes(h) ? `✓${h}` : `${h}`,
      callbackData: `settings:hours:toggle:${h}`,
    }))

    return [row1, row2, row3, [{ text: '« Назад к настройкам', callbackData: 'settings:open' }]]
  } else {
    // Mode: interval - set active hours range
    return [
      [{ text: `Начало: ${user.activeHoursStart}:00`, callbackData: 'noop' }],
      [
        { text: '6', callbackData: 'settings:hours:start:6' },
        { text: '7', callbackData: 'settings:hours:start:7' },
        { text: '8', callbackData: 'settings:hours:start:8' },
        { text: '9', callbackData: 'settings:hours:start:9' },
        { text: '10', callbackData: 'settings:hours:start:10' },
      ],
      [{ text: `Конец: ${user.activeHoursEnd}:00`, callbackData: 'noop' }],
      [
        { text: '18', callbackData: 'settings:hours:end:18' },
        { text: '20', callbackData: 'settings:hours:end:20' },
        { text: '21', callbackData: 'settings:hours:end:21' },
        { text: '22', callbackData: 'settings:hours:end:22' },
        { text: '23', callbackData: 'settings:hours:end:23' },
      ],
      [{ text: '« Назад к настройкам', callbackData: 'settings:open' }],
    ]
  }
}

/**
 * Create hours configuration keyboard (Telegraf format)
 */
export function createHoursKeyboard(user: UserSettings) {
  return toTelegrafKeyboard(createHoursKeyboardLayout(user))
}

/**
 * Create timezone selection keyboard layout (neutral format)
 */
export function createTimezoneKeyboardLayout(currentTimezone: string | null): KeyboardLayout {
  const tz = currentTimezone || 'Europe/Moscow'

  const buttons = TIMEZONES.map((timezone) => ({
    text: timezone.id === tz ? `✓ ${timezone.label}` : timezone.label,
    callbackData: `settings:timezone:${timezone.id}`,
  }))

  // 2 buttons per row
  const rows: KeyboardLayout = []
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2))
  }

  rows.push([{ text: '« Назад к настройкам', callbackData: 'settings:open' }])

  return rows
}

/**
 * Create timezone selection keyboard (Telegraf format)
 */
export function createTimezoneKeyboard(currentTimezone: string | null) {
  return toTelegrafKeyboard(createTimezoneKeyboardLayout(currentTimezone))
}

/**
 * Create back to settings keyboard layout (neutral format)
 */
export function createBackToSettingsKeyboardLayout(): KeyboardLayout {
  return [[{ text: '« К настройкам', callbackData: 'settings:open' }]]
}

/**
 * Create back to settings keyboard (Telegraf format)
 */
export function createBackToSettingsKeyboard() {
  return toTelegrafKeyboard(createBackToSettingsKeyboardLayout())
}
