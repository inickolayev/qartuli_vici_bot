import { Injectable } from '@nestjs/common'
import { PrismaService } from '@/common/prisma/prisma.service'
import { RedisService } from '@/common/redis/redis.service'

export interface HealthCheckResult {
  status: 'ok' | 'error'
  timestamp: string
  uptime: number
  services: {
    database: 'ok' | 'error'
    redis: 'ok' | 'error'
  }
  errors?: string[]
}

@Injectable()
export class HealthService {
  private readonly startTime = Date.now()

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check(): Promise<HealthCheckResult> {
    const errors: string[] = []

    // Check database
    let databaseStatus: 'ok' | 'error' = 'ok'
    try {
      await this.prisma.$queryRaw`SELECT 1`
    } catch (err) {
      databaseStatus = 'error'
      errors.push(`Database: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }

    // Check Redis
    let redisStatus: 'ok' | 'error' = 'ok'
    try {
      const client = this.redis.getClient()
      if (client) {
        await client.ping()
      } else {
        redisStatus = 'error'
        errors.push('Redis: Client not initialized')
      }
    } catch (err) {
      redisStatus = 'error'
      errors.push(`Redis: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }

    const allOk = databaseStatus === 'ok' && redisStatus === 'ok'

    return {
      status: allOk ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptime: (Date.now() - this.startTime) / 1000,
      services: {
        database: databaseStatus,
        redis: redisStatus,
      },
      ...(errors.length > 0 && { errors }),
    }
  }
}
