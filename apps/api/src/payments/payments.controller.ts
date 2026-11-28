import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../common/decorators';
import { CurrentUser, Roles } from '../common/decorators';
import { Role } from '../entities/enums';
import { CreatePaymentDto } from './payments.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Payments') @ApiBearerAuth()
@Roles(Role.MANAGER)
@Controller('payments')
export class PaymentsController {
  constructor(private svc: PaymentsService) {}

  @Post()
  record(@Body() d: CreatePaymentDto, @CurrentUser() me: AuthUser) { return this.svc.record(d, me); }

  @Post(':id/refund') @HttpCode(200)
  refund(@Param('id', ParseUUIDPipe) id: string) { return this.svc.refund(id); }
}