import { AppRole } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class AssignRoleDto {
  @IsEnum(AppRole)
  role!: AppRole;
}
