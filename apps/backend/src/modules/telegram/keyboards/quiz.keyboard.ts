import { Markup } from 'telegraf'

// Random emoji sets for answer options
const OPTION_EMOJIS = ['🔵', '🟢', '🟡', '🟣', '🔴', '🟠', '⚪', '🩵', '🩷', '💚', '💛', '💜']

/**
 * Create quiz answer keyboard with question index to prevent stale button clicks
 */
export function createQuizKeyboard(options: string[] = [], questionIndex: number = 0) {
  const buttons = []

  // If options provided (multiple choice), show them with random emojis
  // Include questionIndex in callback to validate it's the current question
  if (options.length > 0) {
    // Pick random emojis for this question
    const emojis = shuffleArray([...OPTION_EMOJIS]).slice(0, options.length)

    for (let i = 0; i < options.length; i++) {
      const label = `${emojis[i]} ${options[i]}`
      buttons.push([Markup.button.callback(label, `quiz:answer:${questionIndex}:${options[i]}`)])
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

/**
 * Fisher-Yates shuffle
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
