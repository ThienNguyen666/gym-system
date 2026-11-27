import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CommonModule } from './common/common.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { MembersModule } from './members/members.module.js';
import { TrainersModule } from './trainers/trainers.module.js';
import { PackagesModule } from './packages/packages.module.js';
import { ClassesModule } from './classes/classes.module.js';
import { BookingsModule } from './bookings/bookings.module.js';
import { WaitlistModule } from './waitlist/waitlist.module.js';
import { CheckinModule } from './checkin/checkin.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { NoshowModule } from './noshow/noshow.module.js';
import { ChatbotModule } from './chatbot/chatbot.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { AuditModule } from './audit/audit.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { SchedulerModule } from './scheduler/scheduler.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.getOrThrow<string>('DB_HOST'),
        port: Number(config.get('DB_PORT') ?? 5432),
        username: config.getOrThrow<string>('DB_USER'),
        password: config.getOrThrow<string>('DB_PASS'),
        database: config.getOrThrow<string>('DB_NAME'),
        entities: [
          join(
            dirname(fileURLToPath(import.meta.url)),
            '**',
            '*.entity{.ts,.js}',
          ),
        ],
        synchronize: false,
      }),
    }),
    CommonModule,
    AuthModule,
    UsersModule,
    MembersModule,
    TrainersModule,
    PackagesModule,
    ClassesModule,
    BookingsModule,
    WaitlistModule,
    CheckinModule,
    PaymentsModule,
    NoshowModule,
    ChatbotModule,
    DashboardModule,
    AuditModule,
    NotificationsModule,
    SchedulerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
