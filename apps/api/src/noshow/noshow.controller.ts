import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { NoshowService } from './noshow.service.js';
import { CreateNoshowDto } from './dto/create-noshow.dto.js';
import { UpdateNoshowDto } from './dto/update-noshow.dto.js';

@Controller('noshow')
export class NoshowController {
  constructor(private readonly noshowService: NoshowService) {}

  @Post()
  create(@Body() createNoshowDto: CreateNoshowDto) {
    return this.noshowService.create(createNoshowDto);
  }

  @Get()
  findAll() {
    return this.noshowService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.noshowService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateNoshowDto: UpdateNoshowDto) {
    return this.noshowService.update(+id, updateNoshowDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.noshowService.remove(+id);
  }
}
