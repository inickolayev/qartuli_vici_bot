import { plainToInstance } from 'class-transformer'
import { IsEnum, IsNumber, IsOptional, IsString, Min, validateSync } from 'class-validator'

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development

  @IsNumber()
  @Min(1)
  PORT: number = 3000

  @IsString()
  DATABASE_URL: string

  @IsString()
  REDIS_URL: string

  @IsString()
  @IsOptional()
  REDIS_PREFIX?: string = 'qartuli:'

  @IsString()
  TELEGRAM_BOT_TOKEN: string

  @IsString()
  @IsOptional()
  TELEGRAM_WEBHOOK_URL?: string

  @IsString()
  @IsOptional()
  TELEGRAM_WEBHOOK_SECRET?: string

  @IsString()
  @IsOptional()
  OPENAI_API_KEY?: string

  @IsString()
  @IsOptional()
  OPENAI_MODEL?: string = 'gpt-4o-mini'

  @IsString()
  JWT_SECRET: string

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN?: string = '7d'

  @IsNumber()
  @IsOptional()
  QUIZ_DEFAULT_FREQUENCY?: number = 3

  @IsNumber()
  @IsOptional()
  QUIZ_WORDS_PER_SESSION?: number = 10

  @IsString()
  @IsOptional()
  LOG_LEVEL?: string = 'info'

  @IsString()
  @IsOptional()
  ADMIN_TELEGRAM_IDS?: string
}

export function validateConfig(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  })

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  })

  if (errors.length > 0) {
    throw new Error(errors.toString())
  }

  return validatedConfig
}

export const appConfig = () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    url: process.env.REDIS_URL,
    prefix: process.env.REDIS_PREFIX || 'qartuli:',
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    dailyBudgetUsd: parseFloat(process.env.OPENAI_DAILY_BUDGET_USD || '10'),
    maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES || '3', 10),
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  quiz: {
    defaultFrequency: parseInt(process.env.QUIZ_DEFAULT_FREQUENCY || '3', 10),
    wordsPerSession: parseInt(process.env.QUIZ_WORDS_PER_SESSION || '10', 10),
    cooldownHours: parseInt(process.env.QUIZ_COOLDOWN_HOURS || '2', 10),
  },

  admin: {
    telegramIds: (process.env.ADMIN_TELEGRAM_IDS || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .map((id) => BigInt(id)),
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
})
