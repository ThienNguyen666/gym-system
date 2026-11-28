import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DataSource, EntityManager } from 'typeorm';
import { Role, UserStatus } from '../entities/enums';
import { GymClass } from '../entities/gym-class.entity';
import { TrainerAvailability } from '../entities/trainer-availability.entity';
import { TrainerProfile } from '../entities/trainer-profile.entity';
import { User } from '../entities/user.entity';
import { CreateSlotDto, CreateTrainerDto, ListTrainerClassesQuery, UpdateSlotDto, UpdateTrainerDto } from './trainers.dto';

@Injectable()
export class TrainersService {
  constructor(private ds: DataSource) {}

  /** UC-17: tạo hồ sơ + tài khoản Huấn luyện viên trong một transaction (BR14) */
  async create(d: CreateTrainerDto) {
    const email = d.email.toLowerCase();
    const passwordHash = await bcrypt.hash(d.password, 10);
    try {
      return await this.ds.transaction(async (m) => {
        if (await m.existsBy(User, { email })) throw new ConflictException('Email đã được sử dụng');
        const u = await m.save(User, m.create(User, { email, fullName: d.fullName.trim(), role: Role.TRAINER, passwordHash }));
        const t = await m.save(TrainerProfile, { userId: u.id, specialization: d.specialization?.trim() || null });
        return { id: u.id, email: u.email, fullName: u.fullName, status: u.status, specialization: t.specialization };
      });
    } catch (e: any) {
      if ((e?.code ?? e?.driverError?.code) === '23505') throw new ConflictException('Email đã được sử dụng');
      throw e;
    }
  }

  /** Quản lý thấy tất cả kèm email/trạng thái; vai trò khác chỉ thấy HLV đang hoạt động, không có email */
  async list(isManager: boolean) {
    const qb = this.ds.getRepository(TrainerProfile).createQueryBuilder('t')
      .innerJoinAndSelect('t.user', 'u').orderBy('u.fullName', 'ASC');
    if (!isManager) qb.where('u.status = :a', { a: UserStatus.ACTIVE });
    return (await qb.getMany()).map((t) => this.view(t, isManager));
  }

  async get(id: string, isManager: boolean) {
    return this.view(await this.findTrainer(id), isManager);
  }

  async update(id: string, d: UpdateTrainerDto) {
    const t = await this.findTrainer(id);
    if (d.fullName !== undefined) {
      t.user.fullName = d.fullName.trim();
      await this.ds.manager.save(User, t.user);
    }
    if (d.specialization !== undefined) {
      t.specialization = d.specialization.trim() || null;
      await this.ds.manager.save(TrainerProfile, t);
    }
    return this.view(t, true);
  }

  async setStatus(id: string, status: UserStatus) {
    const t = await this.findTrainer(id);
    t.user.status = status;
    await this.ds.manager.save(User, t.user);
    return this.view(t, true);
  }

  // ---------- UC-12: khung giờ rảnh ----------
  async listAvailability(trainerId: string) {
    await this.findTrainer(trainerId);
    return this.ds.manager.find(TrainerAvailability, { where: { trainerId }, order: { dayOfWeek: 'ASC', startTime: 'ASC' } });
  }

  addSlot(trainerId: string, d: CreateSlotDto) {
    this.validateSlot(d.startTime, d.endTime);
    return this.ds.transaction(async (m) => {
      await this.lockTrainer(m, trainerId);
      await this.assertNoOverlap(m, trainerId, d.dayOfWeek, d.startTime, d.endTime);
      return m.save(TrainerAvailability, m.create(TrainerAvailability, {
        trainerId, dayOfWeek: d.dayOfWeek, startTime: d.startTime, endTime: d.endTime,
      }));
    });
  }

  updateSlot(trainerId: string, slotId: string, d: UpdateSlotDto) {
    return this.ds.transaction(async (m) => {
      await this.lockTrainer(m, trainerId);
      const slot = await m.findOneBy(TrainerAvailability, { id: slotId, trainerId });
      if (!slot) throw new NotFoundException('Không tìm thấy khung giờ');
      const dayOfWeek = d.dayOfWeek ?? slot.dayOfWeek;
      const startTime = d.startTime ?? slot.startTime.slice(0, 5);
      const endTime = d.endTime ?? slot.endTime.slice(0, 5);
      this.validateSlot(startTime, endTime);
      await this.assertNoOverlap(m, trainerId, dayOfWeek, startTime, endTime, slotId);
      await m.update(TrainerAvailability, slotId, { dayOfWeek, startTime, endTime });
      return m.findOneByOrFail(TrainerAvailability, { id: slotId });
    });
  }

  async deleteSlot(trainerId: string, slotId: string) {
    const r = await this.ds.manager.delete(TrainerAvailability, { id: slotId, trainerId });
    if (!r.affected) throw new NotFoundException('Không tìm thấy khung giờ');
  }

  // ---------- UC-13: lớp được phân công ----------
  async listClasses(trainerId: string, q: ListTrainerClassesQuery) {
    await this.findTrainer(trainerId);
    const from = q.from ? new Date(q.from) : new Date();
    const to = q.to ? new Date(q.to) : new Date(from.getTime() + 30 * 86400000);
    const rows = await this.ds.getRepository(GymClass).createQueryBuilder('c')
      .where('c.trainerId = :trainerId AND c.startTime >= :from AND c.startTime < :to', { trainerId, from, to })
      .orderBy('c.startTime', 'ASC').getMany();
    return rows.map((c) => ({
      id: c.id, title: c.title, startTime: c.startTime, endTime: c.endTime,
      capacity: c.capacity, confirmedCount: c.confirmedCount, status: c.status,
    }));
  }

  // ---------- nội bộ ----------
  private validateSlot(start: string, end: string) {
    if (end <= start) throw new BadRequestException('Giờ kết thúc phải sau giờ bắt đầu'); // 'HH:mm' so sánh chuỗi được
  }

  private lockTrainer(m: EntityManager, trainerId: string) {
    return m.findOne(TrainerProfile, { where: { userId: trainerId }, lock: { mode: 'pessimistic_write' } })
      .then((t) => { if (!t) throw new NotFoundException('Không tìm thấy Huấn luyện viên'); });
  }

  private async assertNoOverlap(m: EntityManager, trainerId: string, dow: number, start: string, end: string, excludeId?: string) {
    const qb = m.createQueryBuilder(TrainerAvailability, 'a')
      .where('a.trainerId = :trainerId AND a.dayOfWeek = :dow', { trainerId, dow })
      .andWhere('a.startTime < CAST(:end AS time) AND a.endTime > CAST(:start AS time)', { start, end });
    if (excludeId) qb.andWhere('a.id != :excludeId', { excludeId });
    if (await qb.getExists()) throw new ConflictException('Khung giờ trùng với khung giờ đã khai báo');
  }

  private async findTrainer(id: string) {
    const t = await this.ds.manager.findOne(TrainerProfile, { where: { userId: id }, relations: { user: true } });
    if (!t) throw new NotFoundException('Không tìm thấy Huấn luyện viên');
    return t;
  }

  private view(t: TrainerProfile, full: boolean) {
    return {
      id: t.userId, fullName: t.user.fullName, specialization: t.specialization,
      ...(full ? { email: t.user.email, status: t.user.status } : {}),
    };
  }
}