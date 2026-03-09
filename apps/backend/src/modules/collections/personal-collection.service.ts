import { Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { CollectionType, Collection } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service'
import { CollectionsService } from './collections.service'
import { MY_WORDS_COLLECTION_NAME } from './constants/collection.constants'

/**
 * Service for managing user's personal word collection
 */
@Injectable()
export class PersonalCollectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly collectionsService: CollectionsService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(PersonalCollectionService.name)
  }

  /**
   * Get or create user's personal "My Words" collection
   */
  async getOrCreate(userId: string): Promise<Collection> {
    // Find existing personal collection
    const userCollections = await this.prisma.userCollection.findMany({
      where: { userId, isActive: true },
      include: { collection: true },
    })

    const personalCollection = userCollections.find(
      (uc) => uc.collection.name === MY_WORDS_COLLECTION_NAME && uc.collection.creatorId === userId,
    )

    if (personalCollection) {
      return personalCollection.collection
    }

    // Create new personal collection
    const collection = await this.collectionsService.create(
      {
        name: MY_WORDS_COLLECTION_NAME,
        description: 'Мои добавленные слова',
        type: CollectionType.PRIVATE,
      },
      userId,
    )

    // Assign to user
    await this.collectionsService.assignToUser(userId, collection.id)

    this.logger.info({ userId, collectionId: collection.id }, 'Created personal collection')

    return collection
  }
}
