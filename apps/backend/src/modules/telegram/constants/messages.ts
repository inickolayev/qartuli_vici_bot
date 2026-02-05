/**
 * Bot messages in Russian
 */
export const MESSAGES = {
  // Welcome & Registration
  WELCOME: `გამარჯობა, {firstName}!

Добро пожаловать в бот для изучения грузинского языка!

Здесь ты сможешь:
- Учить новые слова с интервальным повторением
- Проходить квизы и отслеживать прогресс
- Зарабатывать XP и открывать достижения

Выбери действие:`,

  WELCOME_BACK: `С возвращением, {firstName}!

Твоя серия: {streak} дней
Уровень: {level} ({xp} XP)

Продолжим учить грузинский?`,

  // Commands
  HELP: `Доступные команды:

/start - Начать работу с ботом
/quiz - Начать квиз
/stats - Посмотреть статистику
/streak - Информация о серии
/achievements - Достижения
/collections - Мои коллекции слов
/add - Добавить новое слово
/join - Присоединиться к коллекции
/settings - Настройки
/help - Эта справка

Удачи в изучении! 🇬🇪`,

  // Placeholders (Phase 1)
  PLACEHOLDER_QUIZ: `Квиз скоро будет доступен!

Здесь ты сможешь проверить знание слов.`,

  PLACEHOLDER_STATS: `Статистика скоро будет доступна!

Здесь ты увидишь свой прогресс.`,

  PLACEHOLDER_STREAK: `Серия скоро будет доступна!

Занимайся каждый день, чтобы не потерять серию!`,

  PLACEHOLDER_ACHIEVEMENTS: `Достижения скоро будут доступны!

Выполняй задания и получай награды!`,

  PLACEHOLDER_COLLECTIONS: `Коллекции скоро будут доступны!

Здесь будут твои наборы слов для изучения.`,

  PLACEHOLDER_SETTINGS: `Настройки скоро будут доступны!

Здесь можно будет настроить частоту квизов и уведомления.`,

  // Errors
  ERROR_GENERIC: 'Произошла ошибка. Попробуй позже.',
  ERROR_NOT_REGISTERED: 'Сначала нажми /start для регистрации.',

  // Buttons
  BUTTON_START_QUIZ: 'Начать квиз',
  BUTTON_MY_STATS: 'Моя статистика',
  BUTTON_MY_STREAK: 'Моя серия',
  BUTTON_ACHIEVEMENTS: 'Достижения',
  BUTTON_COLLECTIONS: 'Коллекции',
  BUTTON_SETTINGS: 'Настройки',
  BUTTON_BACK: '« Назад',
  BUTTON_CLOSE: '✕ Закрыть',
} as const

/**
 * Format message with placeholders
 */
export function formatMessage(template: string, params: Record<string, string | number>): string {
  return Object.entries(params).reduce(
    (message, [key, value]) => message.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value)),
    template,
  )
}
