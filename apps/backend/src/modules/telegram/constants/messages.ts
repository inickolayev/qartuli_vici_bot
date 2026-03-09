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

  // Quiz
  QUIZ_STARTED: `🎯 Квиз начался!

Всего вопросов: {total}
Отвечай на грузинском или русском.
Удачи!`,

  QUIZ_QUESTION: `❓ Вопрос {current}/{total}

<b>{question}</b>`,

  QUIZ_CORRECT: `✅ Правильно!

Ответ: <b>{answer}</b>`,

  QUIZ_INCORRECT: `❌ Неправильно

Твой ответ: {userAnswer}
Правильный ответ: <b>{correctAnswer}</b>`,

  // Word editing
  WORD_EDIT_MENU: `✏️ <b>Редактирование слова</b>

<b>{georgian}</b>

Основной перевод: <b>{russianPrimary}</b>
Альтернативные: {russianAlt}

Что хочешь сделать?`,

  WORD_EDIT_NEW_PRIMARY: `Введи новый основной перевод для <b>{georgian}</b>:`,

  WORD_EDIT_ADD_ALT: `Введи альтернативный перевод для <b>{georgian}</b>:

Текущие: {russianAlt}`,

  WORD_EDIT_SUCCESS: `✅ Слово обновлено!

<b>{georgian}</b> — {russianPrimary}
Альтернативные: {russianAlt}`,

  WORD_EDIT_CANCELLED: `❌ Редактирование отменено.`,

  QUIZ_COMPLETED: `🏆 Квиз завершён!

Правильных ответов: {correct}/{total}
Заработано XP: +{xp}

Отличная работа! Продолжай учиться!`,

  QUIZ_NO_WORDS: `📚 У тебя пока нет слов для изучения.

Добавь коллекцию слов или создай свои слова.`,

  QUIZ_NO_ACTIVE: `🔍 Нет активного квиза.

Нажми "Начать квиз" чтобы начать!`,

  QUIZ_STOPPED: `⏹ Квиз остановлен.

Ты можешь начать новый квиз в любое время.`,

  // Statistics
  STATS_FULL: `📊 <b>Моя статистика</b>

🎯 <b>Уровень {level}</b> ({xp} / {xpToNext} XP)
🔥 Серия: {streak} дн. (рекорд: {longestStreak})

━━━━━━━━━━━━━━━━━━━━

📚 <b>Слова</b> ({totalWords} всего)
{wordProgressBar}
⚪ Новые: {newWords}
🟠 Изучаю: {learningWords}
🟡 Выучено: {learnedWords}
🟢 Освоено: {masteredWords}

━━━━━━━━━━━━━━━━━━━━

🧠 <b>Квизы</b>
Пройдено: {totalQuizzes}
Ответов: {correctAnswers}/{totalAnswers}
Точность: {accuracy}%
{progressBar}

━━━━━━━━━━━━━━━━━━━━

📅 <b>Сегодня</b>
Квизов: {todayQuizzes}
Верных ответов: {todayCorrect}
Заработано: +{todayXp} XP`,

  // Words list
  WORDS_LIST: `📚 <b>Мои слова</b> ({total})
Стр. {page}/{totalPages}

{words}

<i>🟢 освоено  🟡 выучено  🟠 изучаю  ⚪ новое
+N→🟡 = N правильных до "выучено"</i>`,

  WORDS_LIST_EMPTY: `📚 <b>Мои слова</b>

У тебя пока нет изученных слов.
Пройди квиз, чтобы начать учить!`,

  // Placeholders (Phase 1)

  PLACEHOLDER_STATS: `Статистика скоро будет доступна!

Здесь ты увидишь свой прогресс.`,

  PLACEHOLDER_STREAK: `Серия скоро будет доступна!

Занимайся каждый день, чтобы не потерять серию!`,

  PLACEHOLDER_ACHIEVEMENTS: `Достижения скоро будут доступны!

Выполняй задания и получай награды!`,

  PLACEHOLDER_COLLECTIONS: `Коллекции скоро будут доступны!

Здесь будут твои наборы слов для изучения.`,

  // Settings
  SETTINGS_MENU: `⚙️ <b>Настройки обучения</b>

📚 Новых слов в день: <b>{wordsPerDay}</b>
📊 Сегодня изучено: {todayProgress}
🔔 Режим: {mode}
🔄 Напоминания: {interval}

<i>Слова в день / Частота напоминаний:</i>`,

  SETTINGS_UPDATED: `✅ Настройки обновлены!

Новых слов в день: <b>{wordsPerDay}</b>`,

  SETTINGS_PAUSED: `⏸ <b>Обучение на паузе</b>

Ты не будешь получать уведомления о новых словах.
Нажми "Возобновить" когда будешь готов.`,

  SETTINGS_RESUMED: `▶️ <b>Обучение возобновлено!</b>

Ты будешь получать <b>{wordsPerDay}</b> новых слов в день.`,

  SETTINGS_HOURS_SELECT: `⏰ <b>Выбери часы отправки</b>

Нажми на час, чтобы включить/выключить.
✓ = уведомление будет отправлено в этот час.`,

  SETTINGS_HOURS_RANGE: `⏰ <b>Активные часы</b>

Уведомления будут приходить с <b>{start}:00</b> до <b>{end}:00</b>.

Выбери время начала и окончания:`,

  // Learning Push
  LEARNING_PUSH: `📚 <b>Пора учить новые слова!</b>

Сегодня осталось: {remaining} из {total} слов

Нажми "Начать квиз" чтобы продолжить!`,

  LEARNING_DAILY_COMPLETE: `🎉 <b>Дневная цель достигнута!</b>

Ты выучил <b>{total}</b> новых слов сегодня!
Возвращайся завтра за новой порцией.

💡 Совет: можешь повторить уже изученные слова через /quiz`,

  LEARNING_ALL_WORDS_STARTED: `🏆 <b>Все слова в работе!</b>

Ты уже начал изучать все доступные слова.
Добавь новые слова через /add или импортируй список.`,

  // Add Word
  ADD_WORD_USAGE: `Формат команды:
<code>/add грузинское_слово - перевод</code>

Пример:
<code>/add გამარჯობა - привет</code>`,

  ADD_WORD_SUCCESS: `✅ Слово добавлено!

<b>{georgian}</b> — {russian}

Добавлено в коллекцию "{collectionName}"`,

  ADD_WORD_INVALID_GEORGIAN: `❌ Первое слово должно быть на грузинском.

Формат: <code>/add грузинское_слово - перевод</code>`,

  // Bulk Import
  BULK_IMPORT_DETECTED: `📝 Обнаружено <b>{count}</b> грузинских слов:
{preview}

Хочешь перевести их автоматически?`,

  BULK_IMPORT_TRANSLATING: `⏳ Перевожу {count} слов...

Это может занять несколько секунд.`,

  BULK_IMPORT_PREVIEW: `✅ Перевод готов! ({count} слов)

{preview}{more}

💰 Стоимость: ${'{cost}'}`,

  BULK_IMPORT_SUCCESS: `🎉 Импорт завершён!

Добавлено <b>{count}</b> слов в коллекцию "{collectionName}".

Теперь можно начать квиз!`,

  BULK_IMPORT_CANCELLED: `❌ Импорт отменён.`,

  BULK_IMPORT_BUDGET_EXCEEDED: `⚠️ Достигнут дневной лимит переводов.

Попробуй завтра или добавляй слова по одному через /add.`,

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
