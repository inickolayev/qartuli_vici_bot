import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { PinoLogger } from 'nestjs-pino'
import { Prisma, CollectionType } from '@prisma/client'
import { CreateCollectionDto } from './dto/create-collection.dto'
import { Collection, CollectionFilters, CollectionWithWords } from './types/collection.types'
import { nanoid } from 'nanoid'

@Injectable()
export class CollectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CollectionsService.name)
  }

  async create(dto: CreateCollectionDto, creatorId?: string): Promise<Collection> {
    const data: Prisma.CollectionCreateInput = {
      name: dto.name.trim(),
      description: dto.description?.trim(),
      type: dto.type || CollectionType.PRIVATE,
      shareCode: dto.type === CollectionType.SHARED ? this.generateShareCode() : undefined,
      creator: creatorId ? { connect: { id: creatorId } } : undefined,
    }

    const collection = await this.prisma.collection.create({ data })

    this.logger.info({ collectionId: collection.id, name: collection.name }, 'Collection created')
    return collection
  }

  async findAll(filters?: CollectionFilters): Promise<Collection[]> {
    const where = this.buildWhereClause(filters)
    return this.prisma.collection.findMany({ where, orderBy: { createdAt: 'desc' } })
  }

  async findById(id: string): Promise<Collection> {
    const collection = await this.prisma.collection.findUnique({ where: { id } })

    if (!collection) {
      throw new NotFoundException(`Collection with ID "${id}" not found`)
    }

    return collection
  }

  async findByIdWithWords(id: string): Promise<CollectionWithWords> {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
      include: {
        words: {
          include: {
            word: {
              select: {
                id: true,
                georgian: true,
                russianPrimary: true,
              },
            },
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
    })

    if (!collection) {
      throw new NotFoundException(`Collection with ID "${id}" not found`)
    }

    return collection as CollectionWithWords
  }

  async findByShareCode(shareCode: string): Promise<Collection> {
    const collection = await this.prisma.collection.findUnique({
      where: { shareCode },
    })

    if (!collection) {
      throw new NotFoundException(`Collection with share code "${shareCode}" not found`)
    }

    return collection
  }

  async delete(id: string): Promise<void> {
    await this.findById(id)
    await this.prisma.collection.delete({ where: { id } })
    this.logger.info({ collectionId: id }, 'Collection deleted')
  }

  async addWords(collectionId: string, wordIds: string[]): Promise<void> {
    await this.findById(collectionId) // Verify collection exists

    // Get current max order index
    const maxOrder = await this.prisma.collectionWord.findFirst({
      where: { collectionId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    })

    const startIndex = (maxOrder?.orderIndex ?? -1) + 1

    // Create collection-word links
    const data = wordIds.map((wordId, index) => ({
      collectionId,
      wordId,
      orderIndex: startIndex + index,
    }))

    try {
      await this.prisma.collectionWord.createMany({
        data,
        skipDuplicates: true,
      })

      // Update word count
      const wordCount = await this.prisma.collectionWord.count({
        where: { collectionId },
      })

      await this.prisma.collection.update({
        where: { id: collectionId },
        data: { wordCount },
      })

      this.logger.info(
        { collectionId, addedWords: wordIds.length, totalWords: wordCount },
        'Words added to collection',
      )
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') {
          throw new BadRequestException('One or more word IDs are invalid')
        }
      }
      throw error
    }
  }

  async removeWord(collectionId: string, wordId: string): Promise<void> {
    await this.findById(collectionId)

    const deleted = await this.prisma.collectionWord.deleteMany({
      where: { collectionId, wordId },
    })

    if (deleted.count === 0) {
      throw new NotFoundException('Word not found in collection')
    }

    // Update word count
    const wordCount = await this.prisma.collectionWord.count({
      where: { collectionId },
    })

    await this.prisma.collection.update({
      where: { id: collectionId },
      data: { wordCount },
    })

    this.logger.info({ collectionId, wordId }, 'Word removed from collection')
  }

  async assignToUser(userId: string, collectionId: string): Promise<void> {
    await this.findById(collectionId)

    try {
      await this.prisma.userCollection.create({
        data: {
          userId,
          collectionId,
          isActive: true,
        },
      })

      this.logger.info({ userId, collectionId }, 'Collection assigned to user')
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('User already has this collection')
        }
      }
      throw error
    }
  }

  async getUserCollections(userId: string): Promise<Collection[]> {
    const userCollections = await this.prisma.userCollection.findMany({
      where: { userId, isActive: true },
      include: { collection: true },
    })

    return userCollections.map((uc) => uc.collection)
  }

  async joinByShareCode(userId: string, shareCode: string): Promise<Collection> {
    const collection = await this.findByShareCode(shareCode)

    if (collection.type !== CollectionType.SHARED) {
      throw new BadRequestException('This collection is not shareable')
    }

    await this.assignToUser(userId, collection.id)
    return collection
  }

  private buildWhereClause(filters?: CollectionFilters): Prisma.CollectionWhereInput {
    if (!filters) return {}

    const where: Prisma.CollectionWhereInput = {}

    if (filters.type) {
      where.type = filters.type
    }

    if (filters.creatorId) {
      where.creatorId = filters.creatorId
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    return where
  }

  private generateShareCode(): string {
    return nanoid(8)
  }
}
