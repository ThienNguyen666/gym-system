import { Body, Controller, Get, Param, ParseEnumPipe, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import type { AuthUser } from '../common/decorators';
import { CurrentUser, Roles } from '../common/decorators';
import { Role, UserStatus } from '../entities/enums';
import { UsersService } from './users.service';

class CreateManagerDto {
  @IsEmail() email: string;
  @IsString() fullName: string;
  @IsString() @MinLength(8) password: string;
}
class SetStatusDto { @IsEnum(UserStatus) status: UserStatus }

@ApiTags('Users') @ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private svc: UsersService) {}

  @Post('managers') createManager(@Body() d: CreateManagerDto) {
    return this.svc.createManager(d.email, d.fullName, d.password);
  }
  @Get() list(
    @Query('role', new ParseEnumPipe(Role, { optional: true })) role?: Role,
    @Query('status', new ParseEnumPipe(UserStatus, { optional: true })) status?: UserStatus,
  ) {
    return this.svc.list(role, status);
  }
  
  @Patch(':id/status')
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() d: SetStatusDto, @CurrentUser() me: AuthUser) {
    return this.svc.setStatus(id, d.status, me.id);
  }
}