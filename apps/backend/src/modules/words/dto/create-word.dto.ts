import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsArray,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsBoolean,
} from 'class-validator'
import { Difficulty, PartOfSpeech } from '@prisma/client'

export class CreateWordDto {
  @IsString()
  @IsNotEmpty({ message: 'Georgian word must not be empty' })
  @MaxLength(100, { message: 'Georgian word is too long' })
  georgian: string

  @IsString()
  @IsNotEmpty({ message: 'Russian translation must not be empty' })
  @MaxLength(200, { message: 'Russian translation is too long' })
  russianPrimary: string

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  russianAlt?: string[]

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  georgianForms?: string[]

  @IsString()
  @IsOptional()
  @MaxLength(200)
  transcription?: string

  @IsEnum(PartOfSpeech)
  @IsOptional()
  partOfSpeech?: PartOfSpeech

  @IsString()
  @IsOptional()
  @MaxLength(500)
  exampleKa?: string

  @IsString()
  @IsOptional()
  @MaxLength(500)
  exampleRu?: string

  @IsString()
  @IsOptional()
  @MaxLength(500)
  audioUrl?: string

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string

  @IsEnum(Difficulty)
  @IsOptional()
  difficulty?: Difficulty

  @IsInt()
  @Min(0)
  @Max(10000)
  @IsOptional()
  frequency?: number

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[]

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean
}
