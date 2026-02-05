import { IsString, IsNotEmpty, MaxLength, IsOptional, IsEnum } from 'class-validator'
import { CollectionType } from '@prisma/client'

export class CreateCollectionDto {
  @IsString()
  @IsNotEmpty({ message: 'Collection name must not be empty' })
  @MaxLength(100, { message: 'Collection name is too long' })
  name: string

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string

  @IsEnum(CollectionType)
  @IsOptional()
  type?: CollectionType
}
