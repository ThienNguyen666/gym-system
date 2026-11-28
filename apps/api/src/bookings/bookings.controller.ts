import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { assertSelfOrManager } from '../common/access';
import type { AuthUser } from '../common/decorators';
import { CurrentUser, Roles } from '../common/decorators';
import { Role } from '../entities/enums';
import { ListBookingsQuery } from './bookings.dto';
import { BookingsService } from './bookings.service';

@ApiTags('Bookings') @ApiBearerAuth()
@Controller()
export class BookingsController {
  constructor(private svc: BookingsService) {}

  @Roles(Role.MEMBER) @Post('classes/:id/bookings')
  book(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser) { return this.svc.book(id, me); }

  @Roles(Role.MEMBER) @Get('bookings/:id/qr')
  qr(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser) { return this.svc.getQr(id, me); }

  @Roles(Role.MEMBER, Role.MANAGER) @Delete('bookings/:id') @HttpCode(200)
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser) { return this.svc.cancel(id, me); }

  @Roles(Role.MANAGER, Role.MEMBER) @Get('members/:id/bookings')
  listForMember(@Param('id', ParseUUIDPipe) id: string, @Query() q: ListBookingsQuery, @CurrentUser() me: AuthUser) {
    assertSelfOrManager(me, id);
    return this.svc.listForMember(id, q);
  }
}