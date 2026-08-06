import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AppRole, AuditLog, UserRole } from '@prisma/client';
import { Request } from 'express';
import { AdminService, CreatedStaffUser, StaffUser } from './admin.service';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';
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

  @Post('users')
  createStaffUser(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() input: CreateStaffUserDto,
    @Ip() ipAddress: string,
    @Req() request: Request,
  ): Promise<CreatedStaffUser> {
    return this.adminService.createStaffUser(actor.id, input, {
      ipAddress,
      userAgent: request.header('user-agent'),
    });
  }

  @Get('users')
  listStaffUsers(): Promise<StaffUser[]> {
    return this.adminService.listStaffUsers();
  }

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
