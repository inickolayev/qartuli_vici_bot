import { Injectable, OnModuleInit, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import OpenAI from 'openai'
import { PrismaService } from '../../common/prisma/prisma.service'
import { LLMOperation } from '@prisma/client'
import { TranslationResponse, BatchTranslationResponse, LLMConfig } from './types/llm.types'

interface RawTranslationResponse {
  russianPrimary?: unknown
  russianAlt?: unknown
  transcription?: unknown
  partOfSpeech?: unknown
  georgian?: unknown
}

const TRANSLATION_SYSTEM_PROMPT = `You are a Georgian-Russian translator assistant.
Translate Georgian words/phrases to Russian. Return JSON with:
- russianPrimary: main translation
- russianAlt: array of alternative translations (synonyms, different forms)
- transcription: transliteration in Russian (optional)
- partOfSpeech: one of NOUN, VERB, ADJECTIVE, ADVERB, PRONOUN, PREPOSITION, CONJUNCTION, INTERJECTION, NUMERAL, PARTICLE (optional)

Be precise and provide common alternatives when applicable.
Return ONLY valid JSON, no markdown formatting.`

const BATCH_TRANSLATION_SYSTEM_PROMPT = `You are a Georgian-Russian translator assistant.
Translate the list of Georgian words to Russian. Return a JSON array where each item has:
- georgian: original word
- russianPrimary: main translation
- russianAlt: array of alternative translations
- transcription: transliteration (optional)
- partOfSpeech: part of speech (optional)

Return ONLY valid JSON array, no markdown formatting.`

// Pricing per 1M tokens (gpt-4o-mini as of 2024)
const TOKEN_PRICING = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4-turbo': { input: 10, output: 30 },
}

@Injectable()
export class LLMService implements OnModuleInit {
  private client: OpenAI
  private config: LLMConfig

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(LLMService.name)
  }

  async onModuleInit() {
    const apiKey = this.configService.get<string>('openai.apiKey')
    const model = this.configService.get<string>('openai.model') || 'gpt-4o-mini'
    const maxRetries = this.configService.get<number>('openai.maxRetries') || 3
    const dailyBudgetUsd = this.configService.get<number>('openai.dailyBudgetUsd') || 10

    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY is not configured, LLM features will be disabled')
      return
    }

    this.config = { apiKey, model, maxRetries, dailyBudgetUsd }
    this.client = new OpenAI({ apiKey, maxRetries })

    this.logger.info({ model }, 'LLM service initialized')
  }

  /**
   * Translate a single Georgian word to Russian
   */
  async translateWord(georgian: string): Promise<TranslationResponse> {
    this.ensureInitialized()

    const startTime = Date.now()

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: 'system', content: TRANSLATION_SYSTEM_PROMPT },
          { role: 'user', content: `Translate: ${georgian}` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new BadRequestException('Empty response from LLM')
      }

      const parsed = JSON.parse(content) as RawTranslationResponse
      const validated = this.validateTranslationResponse(parsed, georgian)
      const result: TranslationResponse = validated

      // Log usage
      const usage = response.usage
      if (usage) {
        await this.logUsage(
          LLMOperation.WORD_ENRICHMENT,
          usage.prompt_tokens,
          usage.completion_tokens,
          Date.now() - startTime,
        )
      }

      this.logger.info({ georgian, russianPrimary: result.russianPrimary }, 'Word translated')

      return result
    } catch (error) {
      this.logger.error({ error, georgian }, 'Failed to translate word')
      throw error
    }
  }

  /**
   * Translate multiple Georgian words in a single request (more cost efficient)
   */
  async translateBatch(words: string[]): Promise<BatchTranslationResponse> {
    this.ensureInitialized()

    if (words.length === 0) {
      return { translations: [], totalTokens: 0, costUsd: 0 }
    }

    if (words.length > 50) {
      throw new BadRequestException('Maximum 50 words per batch')
    }

    const startTime = Date.now()

    try {
      const wordList = words.map((w, i) => `${i + 1}. ${w}`).join('\n')

      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: 'system', content: BATCH_TRANSLATION_SYSTEM_PROMPT },
          { role: 'user', content: `Translate these Georgian words:\n${wordList}` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new BadRequestException('Empty response from LLM')
      }

      const parsed = JSON.parse(content) as { translations?: unknown[] } | unknown[]
      const translationsArray = Array.isArray(parsed) ? parsed : parsed.translations || []

      if (!Array.isArray(translationsArray)) {
        throw new BadRequestException('Invalid LLM response format: expected array')
      }

      const translations: TranslationResponse[] = translationsArray.map(
        (t: unknown, index: number) => {
          const raw = t as RawTranslationResponse
          return this.validateTranslationResponse(raw, (raw.georgian as string) || words[index])
        },
      )

      // Calculate cost
      const usage = response.usage
      let totalTokens = 0
      let costUsd = 0

      if (usage) {
        totalTokens = usage.total_tokens
        costUsd = this.calculateCost(usage.prompt_tokens, usage.completion_tokens)

        await this.logUsage(
          LLMOperation.WORD_ENRICHMENT,
          usage.prompt_tokens,
          usage.completion_tokens,
          Date.now() - startTime,
        )
      }

      this.logger.info(
        { wordCount: words.length, totalTokens, costUsd },
        'Batch translation completed',
      )

      return { translations, totalTokens, costUsd }
    } catch (error) {
      this.logger.error({ error, wordCount: words.length }, 'Failed to translate batch')
      throw error
    }
  }

  /**
   * Check if daily budget is exceeded
   */
  async checkBudget(): Promise<{ remaining: number; isExceeded: boolean }> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const usage = await this.prisma.lLMUsageLog.aggregate({
      where: {
        createdAt: { gte: today },
      },
      _sum: {
        costUsd: true,
      },
    })

    const spent = usage._sum.costUsd || 0
    const remaining = this.config?.dailyBudgetUsd - spent

    return {
      remaining: Math.max(0, remaining),
      isExceeded: remaining <= 0,
    }
  }

  private ensureInitialized(): void {
    if (!this.client) {
      throw new BadRequestException('LLM service is not configured. Please set OPENAI_API_KEY.')
    }
  }

  /**
   * Validate and sanitize LLM translation response
   */
  private validateTranslationResponse(
    raw: RawTranslationResponse,
    georgian: string,
  ): TranslationResponse {
    if (typeof raw.russianPrimary !== 'string' || !raw.russianPrimary.trim()) {
      throw new BadRequestException(
        `Invalid LLM response: missing russianPrimary for "${georgian}"`,
      )
    }

    const russianAlt: string[] = Array.isArray(raw.russianAlt)
      ? raw.russianAlt.filter((item): item is string => typeof item === 'string')
      : []

    return {
      georgian,
      russianPrimary: raw.russianPrimary.trim(),
      russianAlt,
      transcription: typeof raw.transcription === 'string' ? raw.transcription.trim() : undefined,
      partOfSpeech: typeof raw.partOfSpeech === 'string' ? raw.partOfSpeech.trim() : undefined,
    }
  }

  private calculateCost(promptTokens: number, completionTokens: number): number {
    const pricing =
      TOKEN_PRICING[this.config.model as keyof typeof TOKEN_PRICING] || TOKEN_PRICING['gpt-4o-mini']
    return (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000
  }

  private async logUsage(
    operation: LLMOperation,
    promptTokens: number,
    completionTokens: number,
    latencyMs: number,
    userId?: string,
  ): Promise<void> {
    const costUsd = this.calculateCost(promptTokens, completionTokens)

    await this.prisma.lLMUsageLog.create({
      data: {
        userId,
        operation,
        model: this.config.model,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        costUsd,
        latencyMs,
      },
    })
  }
}
