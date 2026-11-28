import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../common/decorators';
import { CurrentUser, Roles } from '../common/decorators';
import { Role } from '../entities/enums';
import { CreatePackageDto, UpdatePackageDto } from './packages.dto';
import { PackagesService } from './packages.service';

@ApiTags('Packages') @ApiBearerAuth()
@Controller('packages')
export class PackagesController {
  constructor(private svc: PackagesService) {}

  // Hội viên chỉ thấy gói đang bán, Quản lý thấy tất cả
  @Roles(Role.MANAGER, Role.MEMBER) @Get()
  list(@CurrentUser() me: AuthUser) { return this.svc.list(me.role === Role.MEMBER); }

  @Roles(Role.MANAGER) @Post()
  create(@Body() d: CreatePackageDto) { return this.svc.create(d); }

  @Roles(Role.MANAGER) @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() d: UpdatePackageDto) { return this.svc.update(id, d); }
}