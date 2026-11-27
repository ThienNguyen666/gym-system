import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { TrainersService } from './trainers.service.js';
import { CreateTrainerDto } from './dto/create-trainer.dto.js';
import { UpdateTrainerDto } from './dto/update-trainer.dto.js';

@Controller('trainers')
export class TrainersController {
  constructor(private readonly trainersService: TrainersService) {}

  @Post()
  create(@Body() createTrainerDto: CreateTrainerDto) {
    return this.trainersService.create(createTrainerDto);
  }

  @Get()
  findAll() {
    return this.trainersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.trainersService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTrainerDto: UpdateTrainerDto) {
    return this.trainersService.update(+id, updateTrainerDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.trainersService.remove(+id);
  }
}
