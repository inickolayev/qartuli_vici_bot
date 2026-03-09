import { Markup } from 'telegraf'
import { LearningMode } from '@prisma/client'

interface UserSettings {
  newWordsPerDay: number
  learningMode: LearningMode
}

/**
 * Create settings menu keyboard
 */
export function createSettingsKeyboard(user: UserSettings) {
  const isPaused = user.learningMode === LearningMode.PAUSED

  return Markup.inlineKeyboard([
    // Words per day row
    [
      Markup.button.callback(
        user.newWordsPerDay === 10 ? '✓ 10 слов' : '10 слов',
        'settings:words:10',
      ),
      Markup.button.callback(
        user.newWordsPerDay === 20 ? '✓ 20 слов' : '20 слов',
        'settings:words:20',
      ),
      Markup.button.callback(
        user.newWordsPerDay === 30 ? '✓ 30 слов' : '30 слов',
        'settings:words:30',
      ),
    ],
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
 * Create back to settings keyboard
 */
export function createBackToSettingsKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.callback('« К настройкам', 'settings:open')]])
}
