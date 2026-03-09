import { Injectable } from '@nestjs/common'
import { Command, Update, Ctx } from 'nestjs-telegraf'
import { Context } from 'telegraf'
import { PinoLogger } from 'nestjs-pino'
import { PrismaService } from '../../../common/prisma/prisma.service'
import { WordsService } from '../../words/words.service'
import { CollectionsService } from '../../collections/collections.service'
import { PersonalCollectionService } from '../../collections/personal-collection.service'
import { MESSAGES, formatMessage } from '../constants/messages'
import { createBackToMenuKeyboard } from '../keyboards/main.keyboard'

const ADD_WORD_REGEX = /^\/add\s+(.+)\s+-\s+(.+)$/

/**
 * Handler for /add command - adds a new word to user's personal collection
 * Format: /add გამარჯობა - привет
 */
@Update()
@Injectable()
export class AddWordHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wordsService: WordsService,
    private readonly collectionsService: CollectionsService,
    private readonly personalCollectionService: PersonalCollectionService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AddWordHandler.name)
  }

  @Command('add')
  async onAdd(@Ctx() ctx: Context) {
    try {
      const from = ctx.from
      if (!from) {
        await ctx.reply(MESSAGES.ERROR_NOT_REGISTERED, { parse_mode: 'HTML' })
        return
      }

      const message = ctx.message
      if (!message || !('text' in message)) {
        await ctx.reply(MESSAGES.ADD_WORD_USAGE, {
          parse_mode: 'HTML',
          ...createBackToMenuKeyboard(),
        })
        return
      }

      const text = message.text
      const match = ADD_WORD_REGEX.exec(text)

      if (!match) {
        await ctx.reply(MESSAGES.ADD_WORD_USAGE, {
          parse_mode: 'HTML',
          ...createBackToMenuKeyboard(),
        })
        return
      }

      const georgian = match[1].trim()
      const russian = match[2].trim()

      // Validate Georgian text
      if (!this.isGeorgianText(georgian)) {
        await ctx.reply(MESSAGES.ADD_WORD_INVALID_GEORGIAN, {
          parse_mode: 'HTML',
          ...createBackToMenuKeyboard(),
        })
        return
      }

      // Get or create user
      const user = await this.prisma.user.findUnique({
        where: { telegramId: BigInt(from.id) },
      })

      if (!user) {
        await ctx.reply(MESSAGES.ERROR_NOT_REGISTERED, { parse_mode: 'HTML' })
        return
      }

      // Check if word already exists
      const existingWord = await this.wordsService.findByGeorgianAndRussian(georgian, russian)

      const word = existingWord
        ? existingWord
        : await this.wordsService.create(
            {
              georgian,
              russianPrimary: russian,
            },
            user.id,
          )

      // Get or create personal collection
      const personalCollection = await this.personalCollectionService.getOrCreate(user.id)

      // Add word to collection
      try {
        await this.collectionsService.addWords(personalCollection.id, [word.id])
      } catch (error) {
        // Word might already be in collection (duplicate constraint) - that's ok
        if (error instanceof Error && 'code' in error && error.code === 'P2002') {
          this.logger.debug({ wordId: word.id }, 'Word already in collection')
        } else {
          this.logger.warn({ error, wordId: word.id }, 'Unexpected error adding word to collection')
        }
      }

      const response = formatMessage(MESSAGES.ADD_WORD_SUCCESS, {
        georgian,
        russian,
        collectionName: personalCollection.name,
      })

      await ctx.reply(response, {
        parse_mode: 'HTML',
        ...createBackToMenuKeyboard(),
      })

      this.logger.info(
        { userId: user.id, wordId: word.id, georgian, russian },
        'Word added via /add command',
      )
    } catch (error) {
      this.logger.error({ error }, 'Failed to handle /add command')
      await ctx.reply(MESSAGES.ERROR_GENERIC, { parse_mode: 'HTML' })
    }
  }

  private isGeorgianText(text: string): boolean {
    const georgianRegex = /[\u10A0-\u10FF]/
    return georgianRegex.test(text)
  }
}
