import { MESSAGES } from '../constants/messages'
import { KeyboardLayout, toTelegrafKeyboard } from './types'

/**
 * Create main menu keyboard layout (neutral format)
 */
export function createMainKeyboardLayout(): KeyboardLayout {
  return [
    [{ text: MESSAGES.BUTTON_START_QUIZ, callbackData: 'quiz:start' }],
    [
      { text: MESSAGES.BUTTON_MY_STATS, callbackData: 'stats:show' },
      { text: MESSAGES.BUTTON_MY_STREAK, callbackData: 'streak:show' },
    ],
    [
      { text: MESSAGES.BUTTON_ACHIEVEMENTS, callbackData: 'achievements:show' },
      { text: MESSAGES.BUTTON_COLLECTIONS, callbackData: 'collections:list' },
    ],
    [{ text: MESSAGES.BUTTON_SETTINGS, callbackData: 'settings:open' }],
  ]
}

/**
 * Create main menu inline keyboard (Telegraf format)
 */
export function createMainKeyboard() {
  return toTelegrafKeyboard(createMainKeyboardLayout())
}

/**
 * Create back to menu keyboard layout (neutral format)
 */
export function createBackToMenuKeyboardLayout(): KeyboardLayout {
  return [[{ text: MESSAGES.BUTTON_BACK, callbackData: 'menu:main' }]]
}

/**
 * Create back to menu keyboard (Telegraf format)
 */
export function createBackToMenuKeyboard() {
  return toTelegrafKeyboard(createBackToMenuKeyboardLayout())
}

/**
 * Create close keyboard layout (neutral format)
 */
export function createCloseKeyboardLayout(): KeyboardLayout {
  return [[{ text: MESSAGES.BUTTON_CLOSE, callbackData: 'menu:close' }]]
}

/**
 * Create close keyboard (Telegraf format)
 */
export function createCloseKeyboard() {
  return toTelegrafKeyboard(createCloseKeyboardLayout())
}
