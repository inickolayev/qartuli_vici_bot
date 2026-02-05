import { IsNotEmpty, IsString } from 'class-validator'

export class SubmitAnswerDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string

  @IsString()
  @IsNotEmpty()
  userAnswer: string
}
