import { Difficulty, PartOfSpeech, Word as PrismaWord } from '@prisma/client'

export type Word = PrismaWord

export interface WordFilters {
  difficulty?: Difficulty
  partOfSpeech?: PartOfSpeech
  tags?: string[]
  search?: string
  isPublic?: boolean
  creatorId?: string
}

export interface WordPaginationOptions {
  page?: number
  limit?: number
  orderBy?: 'createdAt' | 'georgian' | 'russianPrimary' | 'difficulty'
  orderDirection?: 'asc' | 'desc'
}

export interface WordStats {
  totalCount: number
  byDifficulty: Record<Difficulty, number>
  byPartOfSpeech: Record<string, number>
  publicCount: number
  privateCount: number
}
