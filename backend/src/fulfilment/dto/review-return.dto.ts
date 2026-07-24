import { ReturnStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewReturnDto {
  @IsEnum(ReturnStatus)
  status!: ReturnStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
