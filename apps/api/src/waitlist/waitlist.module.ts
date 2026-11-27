import { Module } from '@nestjs/common';
import { WaitlistService } from './waitlist.service.js';
import { WaitlistController } from './waitlist.controller.js';

@Module({
  controllers: [WaitlistController],
  providers: [WaitlistService],
})
export class WaitlistModule {}
