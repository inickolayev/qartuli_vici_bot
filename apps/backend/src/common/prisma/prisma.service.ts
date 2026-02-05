import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { PinoLogger } from 'nestjs-pino'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly logger: PinoLogger) {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    })
    this.logger.setContext(PrismaService.name)
  }

  async onModuleInit() {
    await this.$connect()
    this.logger.info('Prisma connected to database')

    // Log slow queries in development
    if (process.env.NODE_ENV !== 'production') {
      // @ts-expect-error Prisma event typing
      this.$on('query', (e: { query: string; duration: number }) => {
        if (e.duration > 100) {
          this.logger.warn({ duration: e.duration, query: e.query }, 'Slow query detected')
        }
      })
    }
  }

  async onModuleDestroy() {
    await this.$disconnect()
    this.logger.info('Prisma disconnected from database')
  }

  /**
   * Clean database (for testing only)
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('cleanDatabase() can only be called in test environment')
    }

    const tablenames = await this.$queryRaw<
      { tablename: string }[]
    >`SELECT tablename FROM pg_tables WHERE schemaname='public'`

    const tables = tablenames
      .map(({ tablename }) => tablename)
      .filter((name) => name !== '_prisma_migrations')
      .map((name) => `"public"."${name}"`)
      .join(', ')

    if (tables.length > 0) {
      await this.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`)
    }
  }
}
