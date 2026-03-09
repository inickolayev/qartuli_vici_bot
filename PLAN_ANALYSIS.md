# План-анализ: Qartuli Vici Bot

## Текущее состояние проекта

### Завершённые фазы

#### Phase 0: Инфраструктура ✅ COMPLETED

- Monorepo структура (apps/backend, apps/admin)
- Docker инфраструктура (docker-compose.local.yml, docker-compose.prod.yml)
- NestJS базовый проект с Prisma + Redis
- Logger (Pino), Health check endpoint
- Полная Prisma схема (все 15 моделей реализованы)

#### Phase 1: MVP Core ✅ COMPLETED (частично)

| Компонент               | Статус | Детали                                                            |
| ----------------------- | ------ | ----------------------------------------------------------------- |
| Telegram Bot Foundation | ✅     | telegraf интеграция, /start, /help, /quiz команды                 |
| Word CRUD               | ✅     | WordsService с полным CRUD                                        |
| Collection CRUD         | ✅     | CollectionsService с CRUD и связыванием                           |
| Quiz Session Management | ✅     | QuizService: startQuiz, submitAnswer, getCurrentSession           |
| Word Selector           | ✅     | Алгоритм приоритизации слов (NEW > LEARNING > LEARNED > MASTERED) |
| KA_TO_RU / RU_TO_KA     | ✅     | ExerciseGenerator генерирует оба типа                             |
| Answer Validation Chain | ⚠️     | Только ExactMatch + NormalizedMatch (без AllowedForms)            |
| UserWordProgress        | ✅     | ProgressService с rating, spaced repetition intervals             |
| XP Awards               | ⚠️     | Базовый (10 XP за ответ), без streak bonus                        |

---

## Что НЕ реализовано

### Phase 2: Quiz Enhancement ❌ NOT STARTED

| Задача                        | Статус | Комментарий                                            |
| ----------------------------- | ------ | ------------------------------------------------------ |
| MULTIPLE_CHOICE exercise type | ❌     | Enum есть в схеме, но генератор не поддерживает        |
| Distractor generation         | ❌     | Нет логики выбора "похожих" неправильных ответов       |
| USE_IN_PHRASE exercise type   | ❌     | Enum есть, но не реализован                            |
| Phrase templates              | ❌     | Нет                                                    |
| Quiz Scheduling (Cron)        | ❌     | ScheduleModule подключен, но нет QuizSchedulerService  |
| User timezone support         | ❌     | Поле timezone в User есть, но не используется          |
| Quiet hours                   | ❌     | Поля есть (quietHoursStart/End), логика не реализована |
| Quiz frequency settings       | ❌     | Поле quizFrequency есть, не используется               |

### Phase 3: LLM Integration ❌ NOT STARTED

| Задача                        | Статус | Комментарий                                                                |
| ----------------------------- | ------ | -------------------------------------------------------------------------- |
| LLM Module                    | ❌     | Нет modules/llm/                                                           |
| OpenAI client setup           | ❌     | Нет                                                                        |
| Word Enrichment               | ❌     | Поля russianAlt, georgianForms, transcription не заполняются автоматически |
| Semantic Similarity Validator | ❌     | Нет embeddings                                                             |
| LLM Verification Validator    | ❌     | Таблица LLMVerificationCache есть, логика нет                              |
| Phrase Generation             | ❌     | Нет                                                                        |
| Cost tracking                 | ❌     | Таблица LLMUsageLog есть, но не используется                               |

### Phase 4: Gamification ⚠️ PARTIALLY

| Задача                    | Статус | Комментарий                                          |
| ------------------------- | ------ | ---------------------------------------------------- |
| XP award service          | ⚠️     | Базовая версия в QuizService.completeQuiz()          |
| Level calculation         | ❌     | Поле level есть, но автоматически не пересчитывается |
| Level-up notifications    | ❌     | Нет EventEmitter integration                         |
| Streak calculation        | ❌     | Поля currentStreak/longestStreak не обновляются      |
| Streak notifications      | ❌     | Нет                                                  |
| Achievement model         | ✅     | Prisma схема есть                                    |
| Achievement rule engine   | ❌     | Нет AchievementService                               |
| Achievement check service | ❌     | Нет                                                  |
| /stats command            | ⚠️     | Есть placeholder, но не показывает реальные данные   |
| /streak command           | ❌     | Нет                                                  |
| /achievements command     | ❌     | Нет                                                  |

### Phase 5: Admin Panel ❌ NOT STARTED

| Задача                   | Статус | Комментарий                                   |
| ------------------------ | ------ | --------------------------------------------- |
| Telegram OAuth           | ❌     | Нет modules/auth/                             |
| JWT session handling     | ❌     | Нет                                           |
| Admin guard              | ❌     | Нет                                           |
| Dashboard                | ❌     | apps/admin содержит только skeleton React app |
| User Management UI       | ❌     | Нет                                           |
| Word CRUD UI             | ❌     | Нет                                           |
| Collection management UI | ❌     | Нет                                           |
| Analytics endpoints      | ❌     | Нет                                           |

### Phase 6: Polish & Launch ❌ NOT STARTED

| Задача                  | Статус               |
| ----------------------- | -------------------- |
| Error tracking (Sentry) | ❌                   |
| Metrics (Prometheus)    | ❌                   |
| Documentation           | ❌                   |
| Load testing            | ❌                   |
| Initial content seeding | ⚠️ Есть seed скрипт? |

---

## Отсутствующие модули (по DEVELOPMENT_PLAN.md)

```
src/modules/
├── telegram/     ✅ Есть
├── quiz/         ✅ Есть (базовый)
├── words/        ✅ Есть
├── collections/  ✅ Есть
├── gamification/ ❌ НЕТ (нужен XPService, StreakService, AchievementService)
├── llm/          ❌ НЕТ (нужен OpenAI клиент, validators, caching)
├── auth/         ❌ НЕТ (нужен для admin panel)
└── admin/        ❌ НЕТ (REST API endpoints)
```

---

## Критические пробелы

### 1. AllowedFormsValidator отсутствует

**Проблема**: Ответ "красивая" не принимается как правильный для "красивый"
**Файл**: `apps/backend/src/modules/quiz/validators/`
**Приоритет**: HIGH

### 2. Gamification не работает

**Проблема**: XP начисляется, но level не пересчитывается, streak не отслеживается
**Нужно**: `modules/gamification/` с XPService, StreakService
**Приоритет**: HIGH

### 3. Нет Quiz Scheduler

**Проблема**: Пользователи не получают автоматических напоминаний
**Нужно**: `QuizSchedulerService` с Cron jobs
**Приоритет**: MEDIUM

### 4. LLM Integration отсутствует полностью

**Проблема**: Нельзя верифицировать "близкие" ответы, нельзя обогащать слова
**Нужно**: `modules/llm/` с OpenAI клиентом
**Приоритет**: MEDIUM

### 5. Admin Panel - пустой skeleton

**Проблема**: Нельзя управлять контентом без кода
**Нужно**: Auth + REST API + React компоненты
**Приоритет**: LOW (можно управлять через Prisma Studio)

---

## Рекомендуемый порядок реализации

1. **AllowedFormsValidator** - быстрый fix для улучшения UX
2. **Gamification Module** - критично для вовлечения пользователей
3. **Quiz Scheduler** - автоматические напоминания
4. **MULTIPLE_CHOICE** - разнообразие упражнений
5. **LLM Integration** - улучшенная валидация и обогащение
6. **Admin Panel** - последнее, так как есть Prisma Studio

---

## Файлы для создания

```
apps/backend/src/modules/
├── gamification/
│   ├── gamification.module.ts
│   ├── services/
│   │   ├── xp.service.ts
│   │   ├── streak.service.ts
│   │   └── achievement.service.ts
│   └── types/
│       └── gamification.types.ts
│
├── llm/
│   ├── llm.module.ts
│   ├── providers/
│   │   └── openai.provider.ts
│   ├── services/
│   │   ├── llm.service.ts
│   │   ├── cache.service.ts
│   │   └── enrichment.service.ts
│   └── validators/
│       ├── allowed-forms.validator.ts
│       ├── semantic-similarity.validator.ts
│       └── llm.validator.ts
│
├── quiz/
│   └── services/
│       └── quiz-scheduler.service.ts  # ADD
│
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── guards/
│   │   └── admin.guard.ts
│   └── strategies/
│       └── telegram.strategy.ts
│
└── admin/
    ├── admin.module.ts
    ├── controllers/
    │   ├── users.controller.ts
    │   ├── words.controller.ts
    │   ├── collections.controller.ts
    │   └── analytics.controller.ts
    └── dto/
        └── ...
```

---

## Статистика реализации

| Фаза                      | Прогресс |
| ------------------------- | -------- |
| Phase 0: Infrastructure   | 100%     |
| Phase 1: MVP Core         | 85%      |
| Phase 2: Quiz Enhancement | 0%       |
| Phase 3: LLM Integration  | 0%       |
| Phase 4: Gamification     | 15%      |
| Phase 5: Admin Panel      | 5%       |
| Phase 6: Polish           | 0%       |

**Общий прогресс: ~35%**
