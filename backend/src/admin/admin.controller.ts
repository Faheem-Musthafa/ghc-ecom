import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AppRole, AuditLog, UserRole } from '@prisma/client';
import { Request } from 'express';
import { AdminService } from './admin.service';
import { AssignRoleDto } from './dto/assign-role.dto';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';

@Controller('admin')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(AppRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Put('users/:userId/roles')
  assignRole(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() input: AssignRoleDto,
    @Ip() ipAddress: string,
    @Req() request: Request,
  ): Promise<UserRole> {
    return this.adminService.assignRole(actor.id, userId, input.role, {
      ipAddress,
      userAgent: request.header('user-agent'),
    });
  }

  @Get('audit-logs')
  listAuditLogs(): Promise<AuditLog[]> {
    return this.adminService.listAuditLogs();
  }
}
