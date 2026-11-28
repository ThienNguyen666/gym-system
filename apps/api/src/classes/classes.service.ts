import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { toVN } from '../common/date';
import type { AuthUser } from '../common/decorators';
import { Booking } from '../entities/booking.entity';
import { CheckIn } from '../entities/check-in.entity';
import { BookingStatus, ClassStatus, Role, UserStatus } from '../entities/enums';
import { GymClass } from '../entities/gym-class.entity';
import { TrainerAvailability } from '../entities/trainer-availability.entity';
import { TrainerProfile } from '../entities/trainer-profile.entity';
import { User } from '../entities/user.entity';
import { CreateClassDto, ListClassesQuery, UpdateClassDto } from './classes.dto';

@Injectable()
export class ClassesService {
  constructor(private ds: DataSource) {}

  /** UC-04: lịch lớp. Quản lý thấy mọi trạng thái, vai trò khác chỉ thấy lớp đang lên lịch */
  async list(q: ListClassesQuery, me: AuthUser) {
    const from = q.from ? new Date(q.from) : new Date();
    const to = q.to ? new Date(q.to) : new Date(from.getTime() + 14 * 86400000);
    const qb = this.ds.getRepository(GymClass).createQueryBuilder('c')
      .leftJoinAndSelect('c.trainer', 't').leftJoinAndSelect('t.user', 'u')
      .where('c.startTime >= :from AND c.startTime < :to', { from, to })
      .orderBy('c.startTime', 'ASC');
    if (me.role !== Role.MANAGER) qb.andWhere('c.status = :s', { s: ClassStatus.SCHEDULED });
    if (q.trainerId) qb.andWhere('c.trainerId = :tid', { tid: q.trainerId });
    return (await qb.getMany()).map((c) => this.view(c));
  }

  get(id: string) { return this.getView(this.ds.manager, id); }

  /** UC-20 */
  create(d: CreateClassDto) {
    const start = new Date(d.startTime);
    const end = new Date(d.endTime);
    this.validateTimes(start, end);
    return this.ds.transaction(async (m) => {
      if (d.trainerId) await this.assertTrainerFree(m, d.trainerId, start, end);
      const c = await m.save(GymClass, m.create(GymClass, {
        title: d.title.trim(), startTime: start, endTime: end, capacity: d.capacity,
        trainerId: d.trainerId ?? null, status: ClassStatus.SCHEDULED,
      }));
      return this.getView(m, c.id);
    });
  }

  /** UC-20 (sửa) và UC-21 (phân công): khóa dòng lớp trước, rồi khóa HLV */
  update(id: string, d: UpdateClassDto) {
    return this.ds.transaction(async (m) => {
      const c = await m.findOne(GymClass, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!c) throw new NotFoundException('Không tìm thấy lớp');
      if (c.status !== ClassStatus.SCHEDULED) throw new ConflictException('Lớp đã bị hủy hoặc đã hoàn thành');
      if (c.startTime.getTime() <= Date.now()) throw new ConflictException('Lớp đã bắt đầu, không thể chỉnh sửa');

      const start = d.startTime ? new Date(d.startTime) : c.startTime;
      const end = d.endTime ? new Date(d.endTime) : c.endTime;
      if (d.startTime || d.endTime) this.validateTimes(start, end);

      const capacity = d.capacity ?? c.capacity;
      if (capacity < c.confirmedCount) {
        throw new BadRequestException(`Sức chứa mới nhỏ hơn số lượt đặt hiện có (${c.confirmedCount})`);
      }
      const trainerId: string | null = d.trainerId === undefined ? c.trainerId : d.trainerId;
      if (trainerId && (trainerId !== c.trainerId || d.startTime || d.endTime)) {
        await this.assertTrainerFree(m, trainerId, start, end, id);
      }
      // TODO (bước hủy/đổi lịch, BR10): đổi giờ hoặc HLV khi đã có lượt đặt thì phải thông báo hội viên
      await m.update(GymClass, id, { title: d.title?.trim() ?? c.title, startTime: start, endTime: end, capacity, trainerId });
      return this.getView(m, id);
    });
  }

  /** UC-13: danh sách hội viên của lớp (HLV chỉ xem lớp mình phụ trách) */
  async roster(id: string, me: AuthUser) {
    const m = this.ds.manager;
    const c = await m.findOne(GymClass, { where: { id }, relations: { trainer: { user: true } } });
    if (!c) throw new NotFoundException('Không tìm thấy lớp');
    if (me.role === Role.TRAINER && c.trainerId !== me.id) throw new ForbiddenException('Không đủ quyền truy cập');
    const bookings = await m.find(Booking, {
      where: { classId: id, status: In([BookingStatus.CONFIRMED, BookingStatus.COMPLETED, BookingStatus.NO_SHOW]) },
      relations: { member: { user: true } },
      order: { createdAt: 'ASC' },
    });
    const checkIns = bookings.length ? await m.find(CheckIn, { where: { bookingId: In(bookings.map((b) => b.id)) } }) : [];
    const byBooking = new Map(checkIns.map((ci) => [ci.bookingId, ci]));
    return {
      class: this.view(c),
      roster: bookings.map((b) => ({
        bookingId: b.id, memberId: b.memberId, fullName: b.member.user.fullName, status: b.status,
        checkedInAt: byBooking.get(b.id)?.checkedInAt ?? null, method: byBooking.get(b.id)?.method ?? null,
      })),
    };
  }

  // ---------- BR9: kiểm tra HLV khi phân công ----------
  private async assertTrainerFree(m: EntityManager, trainerId: string, start: Date, end: Date, excludeClassId?: string) {
    // Khóa HLV để hai phân công đồng thời cho cùng một HLV chạy lần lượt
    const t = await m.findOne(TrainerProfile, { where: { userId: trainerId }, lock: { mode: 'pessimistic_write' } });
    if (!t) throw new NotFoundException('Không tìm thấy Huấn luyện viên');
    const u = await m.findOneBy(User, { id: trainerId });
    if (!u || u.status !== UserStatus.ACTIVE) throw new BadRequestException('Huấn luyện viên đang bị khóa');

    // (1) lớp phải nằm trọn trong một khung giờ rảnh (thứ và giờ theo giờ Việt Nam)
    const s = toVN(start);
    const e = toVN(end);
    const slots = await m.find(TrainerAvailability, { where: { trainerId, dayOfWeek: s.dow } });
    const fits = slots.some((a) => a.startTime <= s.time && a.endTime >= e.time); // 'HH:MM:SS' so sánh chuỗi được
    if (!fits) {
      throw new ConflictException({ message: 'Lớp nằm ngoài khung giờ rảnh của Huấn luyện viên', type: 'outside_availability' });
    }

    // (2) không có lớp khác của HLV trùng giờ (lớp liền kề không tính là trùng)
    const qb = m.createQueryBuilder(GymClass, 'c')
      .where('c.trainerId = :trainerId AND c.status = :st', { trainerId, st: ClassStatus.SCHEDULED })
      .andWhere('c.startTime < :end AND c.endTime > :start', { start, end });
    if (excludeClassId) qb.andWhere('c.id != :excludeClassId', { excludeClassId });
    const other = await qb.getOne();
    if (other) {
      throw new ConflictException({
        message: 'Huấn luyện viên đã có lớp trùng giờ', type: 'overlap',
        conflictClass: { id: other.id, title: other.title, startTime: other.startTime, endTime: other.endTime },
      });
    }
  }

  private validateTimes(start: Date, end: Date) {
    if (!(end.getTime() > start.getTime())) throw new BadRequestException('Giờ kết thúc phải sau giờ bắt đầu');
    if (start.getTime() <= Date.now()) throw new BadRequestException('Lớp phải bắt đầu trong tương lai');
    if (toVN(start).date !== toVN(end).date) {
      throw new BadRequestException('Lớp phải bắt đầu và kết thúc trong cùng một ngày (giờ Việt Nam)');
    }
  }

  private async getView(m: EntityManager, id: string) {
    const c = await m.findOne(GymClass, { where: { id }, relations: { trainer: { user: true } } });
    if (!c) throw new NotFoundException('Không tìm thấy lớp');
    return this.view(c);
  }

  private view(c: GymClass) {
    return {
      id: c.id, title: c.title, startTime: c.startTime, endTime: c.endTime,
      capacity: c.capacity, confirmedCount: c.confirmedCount, spotsLeft: c.capacity - c.confirmedCount,
      status: c.status,
      trainer: c.trainer
        ? { id: c.trainer.userId, fullName: c.trainer.user?.fullName ?? null, specialization: c.trainer.specialization }
        : null,
    };
  }
}