import { Markup } from 'telegraf'

/**
 * Create quiz answer keyboard (for multiple choice - Phase 2)
 * For now, just shows skip/stop buttons
 */
export function createQuizKeyboard(options: string[] = []) {
  const buttons = []

  // If options provided (multiple choice), show them
  if (options.length > 0) {
    for (const option of options) {
      buttons.push([Markup.button.callback(option, `quiz:answer:${option}`)])
    }
  }

  // Always show skip and stop buttons
  buttons.push([
    Markup.button.callback('⏭ Пропустить', 'quiz:skip'),
    Markup.button.callback('⏹ Остановить', 'quiz:stop'),
  ])

  return Markup.inlineKeyboard(buttons)
}

/**
 * Create skip-only keyboard
 */
export function createSkipKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('⏭ Пропустить', 'quiz:skip'),
      Markup.button.callback('⏹ Остановить', 'quiz:stop'),
    ],
  ])
}
