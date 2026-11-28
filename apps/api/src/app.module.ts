import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { ChatbotModule } from './chatbot/chatbot.module';
import { CheckinModule } from './checkin/checkin.module';
import { ClassesModule } from './classes/classes.module';
import { CommonModule } from './common/common.module';
import { JwtAuthGuard, RolesGuard } from './common/guards';
import { buildDbOptions } from './config/db.options';
import { DashboardModule } from './dashboard/dashboard.module';
import { MembersModule } from './members/members.module';
import { NoshowModule } from './noshow/noshow.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PackagesModule } from './packages/packages.module';
import { PaymentsModule } from './payments/payments.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { TrainersModule } from './trainers/trainers.module';
import { UsersModule } from './users/users.module';
import { WaitlistModule } from './waitlist/waitlist.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: join(process.cwd(), '..', '..', '.env') }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) =>
        buildDbOptions({
          DB_HOST: cfg.get('DB_HOST'), DB_PORT: cfg.get('DB_PORT'),
          DB_USER: cfg.get('DB_USER'), DB_PASS: cfg.get('DB_PASS'), DB_NAME: cfg.get('DB_NAME'),
        }),
    }),
    CommonModule, AuthModule, UsersModule, MembersModule, TrainersModule, PackagesModule,
    ClassesModule, BookingsModule, WaitlistModule, CheckinModule, PaymentsModule, NoshowModule,
    ChatbotModule, DashboardModule, AuditModule, NotificationsModule, SchedulerModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard }, // 1. phải đăng nhập (trừ @Public)
    { provide: APP_GUARD, useClass: RolesGuard },   // 2. rồi mới kiểm tra vai trò
  ],
})
export class AppModule {}