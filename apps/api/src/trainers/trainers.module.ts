import { Module } from '@nestjs/common';
import { TrainersService } from './trainers.service.js';
import { TrainersController } from './trainers.controller.js';

@Module({
  controllers: [TrainersController],
  providers: [TrainersService],
})
export class TrainersModule {}
