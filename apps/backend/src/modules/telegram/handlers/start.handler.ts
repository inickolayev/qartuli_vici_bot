import { Injectable } from '@nestjs/common'
import { Start, Update, Ctx } from 'nestjs-telegraf'
import { Context } from 'telegraf'
import { PinoLogger } from 'nestjs-pino'
import { PrismaService } from '../../../common/prisma/prisma.service'
import { MESSAGES, formatMessage } from '../constants/messages'
import { createMainKeyboard } from '../keyboards/main.keyboard'

/**
 * Handler for /start command - user registration
 */
@Update()
@Injectable()
export class StartHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(StartHandler.name)
  }

  @Start()
  async onStart(@Ctx() ctx: Context) {
    try {
      const from = ctx.from

      if (!from) {
        await ctx.reply(MESSAGES.ERROR_GENERIC)
        return
      }

      const telegramId = BigInt(from.id)

      // Upsert user - create if not exists, update if exists
      const user = await this.prisma.user.upsert({
        where: { telegramId },
        create: {
          telegramId,
          username: from.username,
          firstName: from.first_name,
          lastName: from.last_name,
          languageCode: from.language_code || 'ru',
          lastActivityAt: new Date(),
        },
        update: {
          username: from.username,
          firstName: from.first_name,
          lastName: from.last_name,
          lastActivityAt: new Date(),
        },
      })

      this.logger.info(
        { telegramId: telegramId.toString(), userId: user.id, isNew: !user.updatedAt },
        'User registered/updated',
      )

      // Check if returning user
      const isReturning = user.xp > 0 || user.currentStreak > 0

      const message = isReturning
        ? formatMessage(MESSAGES.WELCOME_BACK, {
            firstName: from.first_name || 'друг',
            streak: user.currentStreak,
            level: user.level,
            xp: user.xp,
          })
        : formatMessage(MESSAGES.WELCOME, {
            firstName: from.first_name || 'друг',
          })

      await ctx.reply(message, {
        parse_mode: 'HTML',
        ...createMainKeyboard(),
      })
    } catch (error) {
      this.logger.error({ error }, 'Failed to handle /start command')
      await ctx.reply(MESSAGES.ERROR_GENERIC)
    }
  }
}
