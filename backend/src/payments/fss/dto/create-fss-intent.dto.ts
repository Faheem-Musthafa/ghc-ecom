import { IsUUID } from 'class-validator';

export class CreateFssIntentDto {
  @IsUUID()
  quoteId!: string;
}
