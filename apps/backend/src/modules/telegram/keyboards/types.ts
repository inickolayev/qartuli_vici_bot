import { Markup } from 'telegraf'

/**
 * Neutral keyboard button format - used by both Telegram and fake chat
 */
export interface KeyboardButton {
  text: string
  callbackData: string
}

/**
 * Keyboard is array of rows, each row is array of buttons
 */
export type KeyboardLayout = KeyboardButton[][]

/**
 * Convert neutral keyboard format to Telegraf inline keyboard
 */
export function toTelegrafKeyboard(layout: KeyboardLayout) {
  const buttons = layout.map((row) =>
    row.map((btn) => Markup.button.callback(btn.text, btn.callbackData)),
  )
  return Markup.inlineKeyboard(buttons)
}
