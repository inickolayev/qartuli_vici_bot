import { Collection as PrismaCollection, CollectionType } from '@prisma/client'

export type Collection = PrismaCollection

export interface CollectionFilters {
  type?: CollectionType
  creatorId?: string
  search?: string
}

export interface CollectionWithWords extends Collection {
  words: Array<{
    id: string
    wordId: string
    orderIndex: number
    word: {
      id: string
      georgian: string
      russianPrimary: string
    }
  }>
}
