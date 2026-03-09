import { Markup } from 'telegraf'

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
