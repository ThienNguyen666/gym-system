import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { assertSelfOrManager } from '../common/access';
import type { AuthUser } from '../common/decorators';
import { CurrentUser, Roles } from '../common/decorators';
import { Role } from '../entities/enums';
import { CreateMemberDto, ListMembersQuery, RegisterPackageDto, SetMemberStatusDto, UpdateMemberDto } from './members.dto';
import { MembersService } from './members.service';

@ApiTags('Members') @ApiBearerAuth()
@Controller('members')
export class MembersController {
  constructor(private svc: MembersService) {}

  @Roles(Role.MANAGER) @Post()
  create(@Body() d: CreateMemberDto) { return this.svc.create(d); }

  @Roles(Role.MANAGER) @Get()
  list(@Query() q: ListMembersQuery) { return this.svc.list(q); }

  @Roles(Role.MANAGER, Role.MEMBER) @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser) {
    assertSelfOrManager(me, id);
    return this.svc.get(id);
  }

  @Roles(Role.MANAGER, Role.MEMBER) @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() d: UpdateMemberDto, @CurrentUser() me: AuthUser) {
    assertSelfOrManager(me, id);
    return this.svc.update(id, d);
  }

  @Roles(Role.MANAGER) @Patch(':id/status')
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() d: SetMemberStatusDto) {
    return this.svc.setStatus(id, d.status);
  }

  @Roles(Role.MANAGER, Role.MEMBER) @Get(':id/packages')
  listPackages(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser) {
    assertSelfOrManager(me, id);
    return this.svc.listPackages(id);
  }

  @Roles(Role.MANAGER) @Post(':id/packages')
  registerPackage(@Param('id', ParseUUIDPipe) id: string, @Body() d: RegisterPackageDto) {
    return this.svc.registerPackage(id, d.packageId);
  }

  @Roles(Role.MANAGER, Role.MEMBER) @Get(':id/payments')
  listPayments(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser) {
    assertSelfOrManager(me, id);
    return this.svc.listPayments(id);
  }
}