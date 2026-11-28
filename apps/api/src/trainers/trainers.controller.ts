import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { assertTrainerSelf, assertTrainerSelfOrManager } from '../common/access';
import type { AuthUser } from '../common/decorators';
import { CurrentUser, Roles } from '../common/decorators';
import { Role } from '../entities/enums';
import {
      CreateSlotDto, CreateTrainerDto, ListTrainerClassesQuery, SetTrainerStatusDto, UpdateSlotDto, UpdateTrainerDto,
} from './trainers.dto';
import { TrainersService } from './trainers.service';

@ApiTags('Trainers') @ApiBearerAuth()
@Controller('trainers')
export class TrainersController {
  constructor(private svc: TrainersService) {}

  @Roles(Role.MANAGER) @Post()
  create(@Body() d: CreateTrainerDto) { return this.svc.create(d); }

  @Roles(Role.MANAGER, Role.TRAINER, Role.MEMBER) @Get()
  list(@CurrentUser() me: AuthUser) { return this.svc.list(me.role === Role.MANAGER); }

  @Roles(Role.MANAGER, Role.TRAINER, Role.MEMBER) @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser) {
    return this.svc.get(id, me.role === Role.MANAGER);
  }

  @Roles(Role.MANAGER) @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() d: UpdateTrainerDto) { return this.svc.update(id, d); }

  @Roles(Role.MANAGER) @Patch(':id/status')
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() d: SetTrainerStatusDto) {
    return this.svc.setStatus(id, d.status);
  }

  // --- Khung giờ rảnh: HLV tự quản lý, Quản lý chỉ xem ---
  @Roles(Role.MANAGER, Role.TRAINER) @Get(':id/availability')
  listAvailability(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser) {
    assertTrainerSelfOrManager(me, id);
    return this.svc.listAvailability(id);
  }

  @Roles(Role.TRAINER) @Post(':id/availability')
  addSlot(@Param('id', ParseUUIDPipe) id: string, @Body() d: CreateSlotDto, @CurrentUser() me: AuthUser) {
    assertTrainerSelf(me, id);
    return this.svc.addSlot(id, d);
  }

  @Roles(Role.TRAINER) @Patch(':id/availability/:slotId')
  updateSlot(
    @Param('id', ParseUUIDPipe) id: string, @Param('slotId', ParseUUIDPipe) slotId: string,
    @Body() d: UpdateSlotDto, @CurrentUser() me: AuthUser,
  ) {
    assertTrainerSelf(me, id);
    return this.svc.updateSlot(id, slotId, d);
  }

  @Roles(Role.TRAINER) @Delete(':id/availability/:slotId') @HttpCode(204)
  deleteSlot(@Param('id', ParseUUIDPipe) id: string, @Param('slotId', ParseUUIDPipe) slotId: string, @CurrentUser() me: AuthUser) {
    assertTrainerSelf(me, id);
    return this.svc.deleteSlot(id, slotId);
  }

  @Roles(Role.MANAGER, Role.TRAINER) @Get(':id/classes')
  listClasses(@Param('id', ParseUUIDPipe) id: string, @Query() q: ListTrainerClassesQuery, @CurrentUser() me: AuthUser) {
    assertTrainerSelfOrManager(me, id);
    return this.svc.listClasses(id, q);
  }
}