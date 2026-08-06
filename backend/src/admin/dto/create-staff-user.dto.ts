import { AppRole } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateStaffUserDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsEnum(AppRole)
  role!: AppRole;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;
}
