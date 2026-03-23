import { Markup } from 'telegraf'

/**
 * Keyboard for collecting mode - shows word count and done button
 */
export function createBulkImportCollectingKeyboard(wordCount: number) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        wordCount > 0 ? `✅ Готово (${wordCount} слов)` : '✅ Готово',
        'bulk:done',
      ),
    ],
    [Markup.button.callback('❌ Отмена', 'bulk:cancel')],
  ])
}

/**
 * Keyboard for review after collecting - shows existing vs new
 */
export function createBulkImportReviewKeyboard(
  hasNewWords: boolean,
  needsTranslation: boolean = false,
) {
  if (!hasNewWords) {
    return Markup.inlineKeyboard([[Markup.button.callback('👍 Понятно', 'bulk:cancel')]])
  }

  if (needsTranslation) {
    return Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Перевести и сохранить', 'bulk:translate')],
      [Markup.button.callback('✅ Сохранить только готовые', 'bulk:save_pairs')],
      [Markup.button.callback('❌ Отмена', 'bulk:cancel')],
    ])
  }

  // All words have translations, no need for GPT
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Сохранить', 'bulk:save_pairs')],
    [Markup.button.callback('❌ Отмена', 'bulk:cancel')],
  ])
}

/**
 * Keyboard for confirming bulk import detection
 */
export function createBulkImportConfirmKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Да, перевести', 'bulk:translate'),
      Markup.button.callback('❌ Отмена', 'bulk:cancel'),
    ],
  ])
}

/**
 * Keyboard for preview - confirm or edit translations
 */
export function createBulkImportPreviewKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Подтвердить и сохранить', 'bulk:confirm')],
    [Markup.button.callback('❌ Отмена', 'bulk:cancel')],
  ])
}

/**
 * Keyboard during translation process
 */
export function createBulkImportCancelKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.callback('❌ Отменить', 'bulk:cancel')]])
}
