import { Markup } from 'telegraf'
import { LearningMode } from '@prisma/client'

interface UserSettings {
  newWordsPerDay: number
  learningMode: LearningMode
  pushIntervalMinutes: number
  preferredHours: number[]
  activeHoursStart: number
  activeHoursEnd: number
}

/**
 * Create settings menu keyboard
 */
export function createSettingsKeyboard(user: UserSettings) {
  const isPaused = user.learningMode === LearningMode.PAUSED

  return Markup.inlineKeyboard([
    // Words per day row
    [
      Markup.button.callback(user.newWordsPerDay === 10 ? '✓ 10' : '10', 'settings:words:10'),
      Markup.button.callback(user.newWordsPerDay === 20 ? '✓ 20' : '20', 'settings:words:20'),
      Markup.button.callback(user.newWordsPerDay === 30 ? '✓ 30' : '30', 'settings:words:30'),
      Markup.button.callback('слов/день', 'noop'),
    ],
    // Push interval row
    [
      Markup.button.callback(
        user.pushIntervalMinutes === 0 ? '✓ Часы' : 'Часы',
        'settings:interval:0',
      ),
      Markup.button.callback(
        user.pushIntervalMinutes === 60 ? '✓ 1ч' : '1ч',
        'settings:interval:60',
      ),
      Markup.button.callback(
        user.pushIntervalMinutes === 10 ? '✓ 10м' : '10м',
        'settings:interval:10',
      ),
      Markup.button.callback(user.pushIntervalMinutes === 5 ? '✓ 5м' : '5м', 'settings:interval:5'),
    ],
    // Configure hours button
    [Markup.button.callback('⏰ Настроить время', 'settings:hours:menu')],
    // Pause/Resume row
    [
      isPaused
        ? Markup.button.callback('▶️ Возобновить обучение', 'settings:resume')
        : Markup.button.callback('⏸ Поставить на паузу', 'settings:pause'),
    ],
    // Back row
    [Markup.button.callback('« Назад', 'menu:main')],
  ])
}

/**
 * Create hours configuration keyboard
 */
export function createHoursKeyboard(user: UserSettings) {
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]

  if (user.pushIntervalMinutes === 0) {
    // Mode: specific hours - toggle each hour
    const row1 = hours
      .slice(0, 5)
      .map((h) =>
        Markup.button.callback(
          user.preferredHours.includes(h) ? `✓${h}` : `${h}`,
          `settings:hours:toggle:${h}`,
        ),
      )
    const row2 = hours
      .slice(5, 10)
      .map((h) =>
        Markup.button.callback(
          user.preferredHours.includes(h) ? `✓${h}` : `${h}`,
          `settings:hours:toggle:${h}`,
        ),
      )
    const row3 = hours
      .slice(10)
      .map((h) =>
        Markup.button.callback(
          user.preferredHours.includes(h) ? `✓${h}` : `${h}`,
          `settings:hours:toggle:${h}`,
        ),
      )

    return Markup.inlineKeyboard([
      row1,
      row2,
      row3,
      [Markup.button.callback('« Назад к настройкам', 'settings:open')],
    ])
  } else {
    // Mode: interval - set active hours range
    return Markup.inlineKeyboard([
      [Markup.button.callback(`Начало: ${user.activeHoursStart}:00`, 'noop')],
      [
        Markup.button.callback('6', 'settings:hours:start:6'),
        Markup.button.callback('7', 'settings:hours:start:7'),
        Markup.button.callback('8', 'settings:hours:start:8'),
        Markup.button.callback('9', 'settings:hours:start:9'),
        Markup.button.callback('10', 'settings:hours:start:10'),
      ],
      [Markup.button.callback(`Конец: ${user.activeHoursEnd}:00`, 'noop')],
      [
        Markup.button.callback('18', 'settings:hours:end:18'),
        Markup.button.callback('20', 'settings:hours:end:20'),
        Markup.button.callback('21', 'settings:hours:end:21'),
        Markup.button.callback('22', 'settings:hours:end:22'),
        Markup.button.callback('23', 'settings:hours:end:23'),
      ],
      [Markup.button.callback('« Назад к настройкам', 'settings:open')],
    ])
  }
}

/**
 * Create back to settings keyboard
 */
export function createBackToSettingsKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.callback('« К настройкам', 'settings:open')]])
}
