import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { assertSelfOrManager } from '../common/access';
import type { AuthUser } from '../common/decorators';
import { CurrentUser, Roles } from '../common/decorators';
import { Role } from '../entities/enums';
import { WaitlistService } from './waitlist.service';

@ApiTags('Waitlist') @ApiBearerAuth()
@Controller()
export class WaitlistController {
  constructor(private svc: WaitlistService) {}

  @Roles(Role.MEMBER) @Post('classes/:id/waitlist')
  join(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser) { return this.svc.join(id, me); }

  @Roles(Role.MEMBER) @Delete('waitlist/:id') @HttpCode(200)
  leave(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser) { return this.svc.leave(id, me); }

  @Roles(Role.MANAGER, Role.MEMBER) @Get('members/:id/waitlist')
  listForMember(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser) {
    assertSelfOrManager(me, id);
    return this.svc.listForMember(id);
  }

  @Roles(Role.MANAGER, Role.TRAINER) @Get('classes/:id/waitlist')
  listForClass(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser) {
    return this.svc.listForClass(id, me);
  }
}