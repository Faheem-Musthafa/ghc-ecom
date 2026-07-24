import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Address, Profile } from '@prisma/client';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CustomersService } from './customers.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('me')
@UseGuards(SupabaseAuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get('profile')
  getProfile(@CurrentUser() user: AuthenticatedUser): Promise<Profile> {
    return this.customersService.getProfile(user.id);
  }

  @Patch('profile')
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: UpdateProfileDto,
  ): Promise<Profile> {
    return this.customersService.updateProfile(user.id, input);
  }

  @Get('addresses')
  listAddresses(@CurrentUser() user: AuthenticatedUser): Promise<Address[]> {
    return this.customersService.listAddresses(user.id);
  }

  @Post('addresses')
  createAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateAddressDto,
  ): Promise<Address> {
    return this.customersService.createAddress(user.id, input);
  }

  @Patch('addresses/:addressId')
  updateAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('addressId', ParseUUIDPipe) addressId: string,
    @Body() input: UpdateAddressDto,
  ): Promise<Address> {
    return this.customersService.updateAddress(user.id, addressId, input);
  }

  @Delete('addresses/:addressId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ): Promise<void> {
    return this.customersService.deleteAddress(user.id, addressId);
  }
}
