import { MESSAGES } from '../constants/messages'
import { KeyboardLayout, toTelegrafKeyboard } from './types'

export function createTutorChatKeyboardLayout(): KeyboardLayout {
  return [[{ text: MESSAGES.BUTTON_STOP_TUTOR_CHAT, callbackData: 'tutor:stop' }]]
}

export function createTutorChatKeyboard() {
  return toTelegrafKeyboard(createTutorChatKeyboardLayout())
}
