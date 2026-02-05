import { Markup } from 'telegraf'
import { MESSAGES } from '../constants/messages'

/**
 * Create main menu inline keyboard
 */
export function createMainKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback(MESSAGES.BUTTON_START_QUIZ, 'quiz:start')],
    [
      Markup.button.callback(MESSAGES.BUTTON_MY_STATS, 'stats:show'),
      Markup.button.callback(MESSAGES.BUTTON_MY_STREAK, 'streak:show'),
    ],
    [
      Markup.button.callback(MESSAGES.BUTTON_ACHIEVEMENTS, 'achievements:show'),
      Markup.button.callback(MESSAGES.BUTTON_COLLECTIONS, 'collections:list'),
    ],
    [Markup.button.callback(MESSAGES.BUTTON_SETTINGS, 'settings:open')],
  ])
}

/**
 * Create back to menu keyboard
 */
export function createBackToMenuKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.callback(MESSAGES.BUTTON_BACK, 'menu:main')]])
}

/**
 * Create close keyboard (single close button)
 */
export function createCloseKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.callback(MESSAGES.BUTTON_CLOSE, 'menu:close')]])
}
