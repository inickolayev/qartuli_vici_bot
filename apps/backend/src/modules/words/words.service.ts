import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { PinoLogger } from 'nestjs-pino'
import { Prisma, Difficulty } from '@prisma/client'
import { CreateWordDto } from './dto/create-word.dto'
import { UpdateWordDto } from './dto/update-word.dto'
import { Word, WordFilters, WordPaginationOptions, WordStats } from './types/word.types'

@Injectable()
export class WordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(WordsService.name)
  }

  async create(dto: CreateWordDto, creatorId?: string): Promise<Word> {
    try {
      if (!this.isGeorgianText(dto.georgian)) {
        throw new BadRequestException('Georgian field must contain Georgian characters')
      }

      const data: Prisma.WordCreateInput = {
        georgian: dto.georgian.trim(),
        russianPrimary: dto.russianPrimary.trim(),
        russianAlt: dto.russianAlt || [],
        georgianForms: dto.georgianForms || [],
        transcription: dto.transcription?.trim(),
        partOfSpeech: dto.partOfSpeech,
        exampleKa: dto.exampleKa?.trim(),
        exampleRu: dto.exampleRu?.trim(),
        audioUrl: dto.audioUrl?.trim(),
        notes: dto.notes?.trim(),
        difficulty: dto.difficulty || Difficulty.MEDIUM,
        frequency: dto.frequency,
        tags: dto.tags || [],
        isPublic: dto.isPublic || false,
        creator: creatorId ? { connect: { id: creatorId } } : undefined,
      }

      const word = await this.prisma.word.create({ data })

      this.logger.info({ wordId: word.id, georgian: word.georgian }, 'Word created')
      return word
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            `Word "${dto.georgian}" with translation "${dto.russianPrimary}" already exists`,
          )
        }
      }
      throw error
    }
  }

  async findAll(
    filters?: WordFilters,
    pagination?: WordPaginationOptions,
  ): Promise<{ words: Word[]; total: number }> {
    const where = this.buildWhereClause(filters)
    const page = pagination?.page || 1
    const limit = pagination?.limit || 50
    const skip = (page - 1) * limit
    const orderBy = this.buildOrderBy(pagination)

    const [words, total] = await Promise.all([
      this.prisma.word.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.word.count({ where }),
    ])

    return { words, total }
  }

  async findById(id: string): Promise<Word> {
    const word = await this.prisma.word.findUnique({
      where: { id },
    })

    if (!word) {
      throw new NotFoundException(`Word with ID "${id}" not found`)
    }

    return word
  }

  async findByGeorgianAndRussian(georgian: string, russianPrimary: string): Promise<Word | null> {
    return this.prisma.word.findUnique({
      where: {
        georgian_russianPrimary: {
          georgian: georgian.trim(),
          russianPrimary: russianPrimary.trim(),
        },
      },
    })
  }

  async update(id: string, dto: UpdateWordDto): Promise<Word> {
    await this.findById(id)

    if (dto.georgian && !this.isGeorgianText(dto.georgian)) {
      throw new BadRequestException('Georgian field must contain Georgian characters')
    }

    try {
      const data: Prisma.WordUpdateInput = {
        ...(dto.georgian && { georgian: dto.georgian.trim() }),
        ...(dto.russianPrimary && { russianPrimary: dto.russianPrimary.trim() }),
        ...(dto.russianAlt !== undefined && { russianAlt: dto.russianAlt }),
        ...(dto.georgianForms !== undefined && { georgianForms: dto.georgianForms }),
        ...(dto.transcription !== undefined && {
          transcription: dto.transcription?.trim() || null,
        }),
        ...(dto.partOfSpeech !== undefined && { partOfSpeech: dto.partOfSpeech }),
        ...(dto.exampleKa !== undefined && { exampleKa: dto.exampleKa?.trim() || null }),
        ...(dto.exampleRu !== undefined && { exampleRu: dto.exampleRu?.trim() || null }),
        ...(dto.audioUrl !== undefined && { audioUrl: dto.audioUrl?.trim() || null }),
        ...(dto.notes !== undefined && { notes: dto.notes?.trim() || null }),
        ...(dto.difficulty !== undefined && { difficulty: dto.difficulty }),
        ...(dto.frequency !== undefined && { frequency: dto.frequency }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
      }

      const updated = await this.prisma.word.update({
        where: { id },
        data,
      })

      this.logger.info({ wordId: id, changes: Object.keys(dto) }, 'Word updated')
      return updated
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            `Word with georgian="${dto.georgian}" and russianPrimary="${dto.russianPrimary}" already exists`,
          )
        }
      }
      throw error
    }
  }

  async delete(id: string): Promise<void> {
    await this.findById(id)
    await this.prisma.word.delete({ where: { id } })
    this.logger.info({ wordId: id }, 'Word deleted')
  }

  async bulkCreate(dtos: CreateWordDto[], creatorId?: string): Promise<Word[]> {
    const words: Word[] = []

    for (const dto of dtos) {
      try {
        const word = await this.create(dto, creatorId)
        words.push(word)
      } catch (error) {
        if (error instanceof ConflictException) {
          this.logger.warn(
            { georgian: dto.georgian, russian: dto.russianPrimary },
            'Skipping duplicate word',
          )
          continue
        }
        throw error
      }
    }

    this.logger.info({ count: words.length }, 'Bulk word creation completed')
    return words
  }

  async getStats(filters?: WordFilters): Promise<WordStats> {
    const where = this.buildWhereClause(filters)

    const [total, byDifficulty, byPartOfSpeech, publicCount] = await Promise.all([
      this.prisma.word.count({ where }),
      this.prisma.word.groupBy({
        by: ['difficulty'],
        where,
        _count: true,
      }),
      this.prisma.word.groupBy({
        by: ['partOfSpeech'],
        where,
        _count: true,
      }),
      this.prisma.word.count({ where: { ...where, isPublic: true } }),
    ])

    const difficultyMap = Object.values(Difficulty).reduce(
      (acc, d) => ({ ...acc, [d]: 0 }),
      {} as Record<Difficulty, number>,
    )
    byDifficulty.forEach((item) => {
      difficultyMap[item.difficulty] = item._count
    })

    const partOfSpeechMap = byPartOfSpeech.reduce(
      (acc, item) => ({
        ...acc,
        [item.partOfSpeech || 'UNKNOWN']: item._count,
      }),
      {} as Record<string, number>,
    )

    return {
      totalCount: total,
      byDifficulty: difficultyMap,
      byPartOfSpeech: partOfSpeechMap,
      publicCount,
      privateCount: total - publicCount,
    }
  }

  private buildWhereClause(filters?: WordFilters): Prisma.WordWhereInput {
    if (!filters) return {}

    const where: Prisma.WordWhereInput = {}

    if (filters.difficulty) {
      where.difficulty = filters.difficulty
    }

    if (filters.partOfSpeech) {
      where.partOfSpeech = filters.partOfSpeech
    }

    if (filters.tags && filters.tags.length > 0) {
      where.tags = { hasSome: filters.tags }
    }

    if (filters.search) {
      where.OR = [
        { georgian: { contains: filters.search, mode: 'insensitive' } },
        { russianPrimary: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    if (filters.isPublic !== undefined) {
      where.isPublic = filters.isPublic
    }

    if (filters.creatorId) {
      where.creatorId = filters.creatorId
    }

    return where
  }

  private buildOrderBy(pagination?: WordPaginationOptions): Prisma.WordOrderByWithRelationInput {
    const field = pagination?.orderBy || 'createdAt'
    const direction = pagination?.orderDirection || 'desc'
    return { [field]: direction }
  }

  private isGeorgianText(text: string): boolean {
    const georgianRegex = /[\u10A0-\u10FF]/
    return georgianRegex.test(text)
  }
}
