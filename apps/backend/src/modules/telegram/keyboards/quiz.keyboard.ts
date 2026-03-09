import { Markup } from 'telegraf'

/**
 * Create quiz answer keyboard with question index to prevent stale button clicks
 */
export function createQuizKeyboard(options: string[] = [], questionIndex: number = 0) {
  const buttons = []

  // If options provided (multiple choice), show them
  // Include questionIndex in callback to validate it's the current question
  if (options.length > 0) {
    for (const option of options) {
      buttons.push([Markup.button.callback(option, `quiz:answer:${questionIndex}:${option}`)])
    }
  }

  // Always show skip and stop buttons with question index
  buttons.push([
    Markup.button.callback('⏭ Пропустить', `quiz:skip:${questionIndex}`),
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
