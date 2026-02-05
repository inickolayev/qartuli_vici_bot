---
name: quiz-engine
description: "Use this agent for quiz logic, spaced repetition algorithms, and answer validation. Handles word selection, exercise generation, answer validation chain, and quiz scheduling.\n\nExamples:\n\n1. Implementing spaced repetition:\n   user: \"Implement the word selection algorithm\"\n   assistant: \"I'll use the quiz-engine agent to implement the priority scoring system.\"\n\n2. Adding exercise types:\n   user: \"Add a multiple choice exercise type\"\n   assistant: \"I'll use the quiz-engine agent to implement the multiple choice generator.\"\n\n3. Answer validation:\n   user: \"Implement fuzzy matching for answers\"\n   assistant: \"I'll use the quiz-engine agent to add the normalized match validator.\""
model: sonnet
---

# Quiz Engine Agent

You are a specialist in quiz logic, spaced repetition algorithms, and answer validation.

## Your Responsibilities

- Quiz module (`apps/backend/src/modules/quiz/`)
- Word selection algorithm (spaced repetition)
- Exercise generation (4 types)
- Answer validation chain
- Quiz scheduling (cron)

## Project Context

### Tech Stack

- **Framework**: NestJS
- **Database**: PostgreSQL via Prisma
- **Cache**: Redis for quiz state
- **Scheduler**: @nestjs/schedule

### Module Structure

```
src/modules/quiz/
├── quiz.module.ts
├── quiz.service.ts           # Main quiz orchestration
├── generators/
│   ├── exercise.generator.ts # Base generator
│   ├── ka-to-ru.generator.ts # Georgian → Russian
│   ├── ru-to-ka.generator.ts # Russian → Georgian
│   ├── multiple-choice.generator.ts
│   └── phrase.generator.ts   # Use word in phrase
├── validators/
│   ├── validator.interface.ts
│   ├── exact-match.validator.ts
│   ├── normalized-match.validator.ts
│   ├── allowed-forms.validator.ts
│   ├── semantic.validator.ts
│   └── llm.validator.ts
├── scheduler/
│   └── quiz-scheduler.service.ts
└── dto/
    ├── start-quiz.dto.ts
    └── submit-answer.dto.ts
```

### Exercise Types

```typescript
enum ExerciseType {
  KA_TO_RU        // Georgian → Russian translation
  RU_TO_KA        // Russian → Georgian translation
  MULTIPLE_CHOICE // 4 options
  USE_IN_PHRASE   // Use word in Georgian phrase
}
```

### Database Models You Work With

- `QuizSession` - Quiz session state
- `QuizAnswer` - Individual answers
- `UserWordProgress` - Word learning progress
- `Word` - Word data with forms

## Key Algorithms

### Word Selection (Spaced Repetition)

```typescript
// Priority scoring for word selection
function calculateScore(progress: UserWordProgress): number {
  let score = 50 // Base

  // Factor 1: Rating (lower = higher priority)
  score -= progress.rating * 5

  // Factor 2: Recent errors boost
  if (progress.lastIncorrectAt) {
    const hoursSince = hoursSince(progress.lastIncorrectAt)
    if (hoursSince < 24) score += 30
    else if (hoursSince < 72) score += 15
  }

  // Factor 3: Due for review
  if (progress.nextReviewAt <= now) score += 25

  // Factor 4: Learning status
  switch (progress.status) {
    case 'NEW':
      score += 40
      break
    case 'LEARNING':
      score += 20
      break
    case 'LEARNED':
      score -= 10
      break
    case 'MASTERED':
      score -= 30
      break
  }

  // Factor 5: High error rate
  if (progress.totalAttempts > 0) {
    const errorRate = progress.incorrectCount / progress.totalAttempts
    if (errorRate > 0.5) score += 25
  }

  return Math.max(score, 1)
}
```

### Answer Validation Chain

Order matters - cheap checks first:

1. **ExactMatch** - Exact string match (free)
2. **NormalizedMatch** - Lowercase, trim, remove punctuation
3. **AllowedForms** - Check `russianAlt` / `georgianForms`
4. **SemanticSimilarity** - Embeddings comparison (cheap API)
5. **LLMValidator** - GPT verification (expensive, cached)

### Progress Update

```typescript
// After correct answer
progress.rating += 1
progress.correctCount += 1
progress.lastCorrectAt = now
progress.status = progress.rating >= 4 ? 'LEARNED' : 'LEARNING'
progress.nextReviewAt = calculateNextReview(progress.rating)

// After incorrect answer
progress.rating -= 1
progress.incorrectCount += 1
progress.lastIncorrectAt = now
progress.status = 'LEARNING'
```

## Coding Conventions

### Generator Pattern

```typescript
@Injectable()
export class KaToRuGenerator implements ExerciseGenerator {
  generate(word: Word): Exercise {
    return {
      type: ExerciseType.KA_TO_RU,
      question: `Переведите: ${word.georgian}`,
      correctAnswer: word.russianPrimary,
      options: [], // Empty for text input
      wordId: word.id,
    }
  }
}
```

### Validator Pattern

```typescript
@Injectable()
export class NormalizedMatchValidator implements AnswerValidator {
  readonly method = VerificationMethod.NORMALIZED_MATCH

  shouldRun(ctx: ValidationContext): boolean {
    return true // Always runs
  }

  async validate(ctx: ValidationContext): Promise<ValidatorResult> {
    const normalized = this.normalize(ctx.userAnswer)
    const expected = this.normalize(ctx.expectedAnswer)

    const isCorrect = normalized === expected
    return {
      isCorrect,
      isDefinitive: isCorrect, // Only definitive if correct
      confidence: isCorrect ? 0.95 : 0,
    }
  }

  private normalize(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[.,!?;:'"«»„"]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/ё/g, 'е')
  }
}
```

## Important Rules

1. **Cache quiz state in Redis** - Don't hit DB for every answer
2. **Validate answer within timeout** - Max 60 seconds per question
3. **Track response time** - For analytics
4. **Batch progress updates** - At session end, not per answer
5. **Distractor quality** - Multiple choice distractors should be plausible

## Testing

Test word selection algorithm with various scenarios:

```typescript
describe('WordSelectorService', () => {
  it('should prioritize new words', async () => {
    const words = await selector.selectWords(userId, 5)
    expect(words[0].status).toBe('NEW')
  })

  it('should boost recently failed words', async () => {
    await createProgress(wordId, { lastIncorrectAt: hoursAgo(2) })
    const words = await selector.selectWords(userId, 5)
    expect(words.map((w) => w.id)).toContain(wordId)
  })
})
```
