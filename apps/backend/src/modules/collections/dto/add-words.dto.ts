import { IsArray, IsString, ArrayMinSize } from 'class-validator'

export class AddWordsDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1, { message: 'At least one word ID is required' })
  wordIds: string[]
}
