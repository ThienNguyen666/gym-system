import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../common/decorators';
import { CurrentUser, Roles } from '../common/decorators';
import { Role } from '../entities/enums';
import { AssignTrainerDto, CreateClassDto, ListClassesQuery, UpdateClassDto } from './classes.dto';
import { ClassesService } from './classes.service';

@ApiTags('Classes') @ApiBearerAuth()
@Controller('classes')
export class ClassesController {
  constructor(private svc: ClassesService) {}

  @Roles(Role.MANAGER) @Post()
  create(@Body() d: CreateClassDto) { return this.svc.create(d); }

  @Roles(Role.MANAGER, Role.TRAINER, Role.MEMBER) @Get()
  list(@Query() q: ListClassesQuery, @CurrentUser() me: AuthUser) { return this.svc.list(q, me); }

  @Roles(Role.MANAGER, Role.TRAINER, Role.MEMBER) @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) { return this.svc.get(id); }

  @Roles(Role.MANAGER) @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() d: UpdateClassDto) { return this.svc.update(id, d); }

  @Roles(Role.MANAGER) @Put(':id/trainer')
  assignTrainer(@Param('id', ParseUUIDPipe) id: string, @Body() d: AssignTrainerDto) {
    return this.svc.update(id, { trainerId: d.trainerId });
  }

  @Roles(Role.MANAGER, Role.TRAINER) @Get(':id/roster')
  roster(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser) { return this.svc.roster(id, me); }
}