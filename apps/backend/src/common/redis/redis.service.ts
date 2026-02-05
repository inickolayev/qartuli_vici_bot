import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import Redis from 'ioredis'

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis
  private readonly prefix: string

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(RedisService.name)
    this.prefix = this.configService.get<string>('redis.prefix', 'qartuli:')
  }

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('redis.url')

    if (!redisUrl) {
      this.logger.warn('Redis URL not configured, using mock client')
      return
    }

    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          this.logger.error('Redis connection failed after 3 retries')
          return null
        }
        return Math.min(times * 200, 2000)
      },
    })

    this.client.on('connect', () => {
      this.logger.info('Redis connected')
    })

    this.client.on('error', (err) => {
      this.logger.error({ err }, 'Redis error')
    })
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit()
      this.logger.info('Redis disconnected')
    }
  }

  private prefixKey(key: string): string {
    return `${this.prefix}${key}`
  }

  // Basic operations
  async get(key: string): Promise<string | null> {
    return this.client.get(this.prefixKey(key))
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const prefixedKey = this.prefixKey(key)
    if (ttlSeconds) {
      await this.client.setex(prefixedKey, ttlSeconds, value)
    } else {
      await this.client.set(prefixedKey, value)
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(this.prefixKey(key))
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(this.prefixKey(key))
    return result === 1
  }

  // JSON helpers
  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.get(key)
    if (!value) return null
    try {
      return JSON.parse(value) as T
    } catch {
      return null
    }
  }

  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds)
  }

  // List operations
  async lpush(key: string, ...values: string[]): Promise<number> {
    return this.client.lpush(this.prefixKey(key), ...values)
  }

  async rpop(key: string): Promise<string | null> {
    return this.client.rpop(this.prefixKey(key))
  }

  async llen(key: string): Promise<number> {
    return this.client.llen(this.prefixKey(key))
  }

  // Hash operations
  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(this.prefixKey(key), field)
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    await this.client.hset(this.prefixKey(key), field, value)
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(this.prefixKey(key))
  }

  // Increment
  async incr(key: string): Promise<number> {
    return this.client.incr(this.prefixKey(key))
  }

  async incrby(key: string, increment: number): Promise<number> {
    return this.client.incrby(this.prefixKey(key), increment)
  }

  // TTL
  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(this.prefixKey(key), seconds)
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(this.prefixKey(key))
  }

  // Raw client access (for advanced operations)
  getClient(): Redis {
    return this.client
  }
}
