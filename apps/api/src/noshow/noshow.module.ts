import { Module } from '@nestjs/common';
import { NoshowService } from './noshow.service.js';
import { NoshowController } from './noshow.controller.js';

@Module({
  controllers: [NoshowController],
  providers: [NoshowService],
})
export class NoshowModule {}
