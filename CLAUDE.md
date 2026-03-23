# Qartuli Vici Bot - Project Instructions

## Overview

Telegram bot for learning Georgian language with spaced repetition, gamification, and LLM-powered answer verification.

## Tech Stack

- **Backend**: NestJS + Prisma + PostgreSQL + Redis
- **Frontend**: React + Vite + Tailwind (admin panel)
- **Bot**: Telegraf
- **LLM**: OpenAI API

## Project Structure

```
qartuli_vici_bot/
├── apps/
│   ├── backend/           # NestJS API + Telegram bot
│   │   ├── src/
│   │   │   ├── common/    # Shared: Prisma, Redis, guards
│   │   │   ├── config/    # Configuration
│   │   │   └── modules/   # Feature modules
│   │   └── prisma/        # Database schema
│   └── admin/             # React admin panel
├── .claude/
│   └── agents/            # Specialized sub-agents
├── DEVELOPMENT_PLAN.md    # Full implementation plan
└── docker-compose.*.yml   # Docker configs
```

## Available Sub-Agents

Use these agents for parallel development:

| Agent             | Command                  | Responsibility                         |
| ----------------- | ------------------------ | -------------------------------------- |
| telegram-bot      | `Task telegram-bot`      | Bot commands, keyboards, scenes        |
| quiz-engine       | `Task quiz-engine`       | Word selection, validation, scheduling |
| words-collections | `Task words-collections` | Words CRUD, collections, enrichment    |
| gamification      | `Task gamification`      | XP, levels, streaks, achievements      |
| llm-integration   | `Task llm-integration`   | OpenAI client, caching, costs          |
| admin-api         | `Task admin-api`         | REST API for admin panel               |

## Coding Conventions

### Immutability

Always create new objects, never mutate:

```typescript
// ✅ Good
const updated = { ...user, xp: user.xp + 10 }

// ❌ Bad
user.xp += 10
```

### File Size

- Keep files under 400 lines
- Extract utilities when files grow large

### Error Handling

```typescript
try {
  const result = await operation()
  return result
} catch (error) {
  this.logger.error({ error }, 'Operation failed')
  throw new BadRequestException('User-friendly message')
}
```

### Database

- Use Prisma transactions for multi-table updates
- Always add indexes for frequently queried fields
- Use BigInt for Telegram IDs
- **NEVER create migrations manually** - always use `npx prisma migrate dev --name <name>` to generate migrations from schema changes

## Commands

**ALWAYS use Docker for local development:**

```bash
# Local development (THE ONLY WAY to run locally)
docker compose -f docker-compose.local.yml up

# NEVER use npm run dev or direct npm commands for running the app
```

```bash
# Database (these are OK to run directly)
npm run db:migrate:dev   # Create migration
npm run db:generate      # Generate Prisma client
npm run db:studio        # Open Prisma Studio

# Quality (these are OK to run directly)
npm run lint             # Run ESLint
npm run test             # Run tests
npm run build            # Build all (for CI/testing only)
```

## Deployment

**CRITICAL DEPLOYMENT RULES:**

1. **ALWAYS test locally first** before any deployment
2. **NEVER deploy without user approval** - wait for explicit confirmation that everything works locally
3. **NEVER manually deploy** - no rsync, scp, or ssh to copy files to server
4. **ONLY deploy through GitHub Actions** when user approves

To deploy (only after user approval):

```bash
gh workflow run deploy-prod.yml
```

The workflow handles:

- Syncing files via rsync
- Building Docker containers
- Running migrations
- Restarting services

## Environment Variables

Copy `.env.example` to `.env` and fill in:

- `TELEGRAM_BOT_TOKEN` - From @BotFather
- `OPENAI_API_KEY` - From OpenAI
- `JWT_SECRET` - Random 32+ char string
- `ADMIN_TELEGRAM_IDS` - Your Telegram ID

## Development Plan

See `DEVELOPMENT_PLAN.md` for:

- Full database schema
- Algorithm implementations
- API contracts
- Phase-by-phase roadmap

Current phase: **Phase 1 - MVP Core**
