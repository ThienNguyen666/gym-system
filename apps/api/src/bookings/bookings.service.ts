import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { DataSource, EntityManager } from 'typeorm';
import { toVN } from '../common/date';
import type { AuthUser } from '../common/decorators';
import { QR_PREFIX, RULES } from '../common/rules';
import { Booking } from '../entities/booking.entity';
import { BookingStatus, ClassStatus, MemberPackageStatus, Role, UserStatus, WaitlistStatus } from '../entities/enums';
import { GymClass } from '../entities/gym-class.entity';
import { MemberPackage } from '../entities/member-package.entity';
import { MemberProfile } from '../entities/member-profile.entity';
import { User } from '../entities/user.entity';
import { WaitlistEntry } from '../entities/waitlist-entry.entity';
import { ListBookingsQuery } from './bookings.dto';

@Injectable()
export class BookingsService {
  constructor(private ds: DataSource) {}

  /**
   * UC-05: đặt lớp (phương án P2). Mọi kiểm tra BR2 nằm trong MỘT transaction.
   * Thứ tự ghi cố định: lớp -> gói -> lượt đặt (thứ tự khóa lớp -> gói, không deadlock).
   * Câu UPDATE có điều kiện là chốt chặn thật cho (I1), (I2); các kiểm tra đọc trước chỉ để báo lỗi rõ ràng.
   */
  async book(classId: string, me: AuthUser) {
    try {
      return await this.ds.transaction(async (m) => {
        const cls = await m.findOneBy(GymClass, { id: classId });
        if (!cls) throw new NotFoundException('Không tìm thấy lớp');
        if (cls.status !== ClassStatus.SCHEDULED) throw this.rule('class_not_open', 'Lớp đã bị hủy hoặc đã kết thúc');
        if (cls.startTime.getTime() <= Date.now()) throw this.rule('class_started', 'Lớp đã bắt đầu');

        // BR2(b): gói đang hoạt động và còn hiệu lực vào ngày diễn ra lớp (ngày theo giờ VN)
        const pkg = await m.findOneBy(MemberPackage, { memberId: me.id, status: MemberPackageStatus.ACTIVE });
        if (!pkg) throw this.rule('no_active_package', 'Bạn chưa có gói tập đang hoạt động');
        const day = toVN(cls.startTime).date;
        if (pkg.startDate > day || (pkg.endDate && pkg.endDate < day)) {
          throw this.rule('package_not_valid_on_class_date', 'Gói tập không còn hiệu lực vào ngày diễn ra lớp');
        }

        // BR2(c): kiểm tra sớm cho thông báo rõ ràng; ràng buộc unique của DB mới là chốt chặn thật
        if (await m.existsBy(Booking, { memberId: me.id, classId, status: BookingStatus.CONFIRMED })) {
          throw this.rule('already_booked', 'Bạn đã đặt lớp này');
        }

        // BR2(e), bất biến (I1): P2
        const c = await m.createQueryBuilder().update(GymClass)
          .set({ confirmedCount: () => 'confirmed_count + 1' })
          .where('id = :id AND status = :st AND start_time > NOW() AND confirmed_count < capacity',
            { id: classId, st: ClassStatus.SCHEDULED })
          .execute();
        if (!c.affected) throw await this.explainClassRejection(m, classId);

        // BR2(f), bất biến (I2): P2. Đồng thời chốt "gói còn active" (chặn đặt chỗ bằng gói vừa bị hoàn tiền)
        const p = await m.createQueryBuilder().update(MemberPackage)
          .set({ pendingCount: () => 'pending_count + 1' })
          .where('id = :id AND status = :st AND (sessions_remaining IS NULL OR pending_count < sessions_remaining)',
            { id: pkg.id, st: MemberPackageStatus.ACTIVE })
          .execute();
        if (!p.affected) { // throw trong transaction => bộ đếm lớp ở trên được rollback
          const now = await m.findOneBy(MemberPackage, { id: pkg.id });
          if (!now || now.status !== MemberPackageStatus.ACTIVE) throw this.rule('no_active_package', 'Gói tập không còn hoạt động');
          throw this.rule('sessions_exhausted', 'Gói đã giữ chỗ hết số buổi còn lại');
        }

        const b = await m.save(Booking, m.create(Booking, { memberId: me.id, classId, memberPackageId: pkg.id }));
        // 4b: đặt trực tiếp được thì không còn cần giữ chỗ trong hàng chờ của lớp này
        await m.update(WaitlistEntry,
          { memberId: me.id, classId, status: WaitlistStatus.WAITING },
          { status: WaitlistStatus.CANCELLED });
        const after = await m.findOneByOrFail(GymClass, { id: classId });
        return {
          id: b.id, status: b.status, classId, memberPackageId: pkg.id, createdAt: b.createdAt,
          spotsLeft: after.capacity - after.confirmedCount,
        };
      });
    } catch (e: any) {
      // hai yêu cầu cùng (hội viên, lớp) chạy đồng thời: unique index chặn, transaction đã rollback
      if ((e?.code ?? e?.driverError?.code) === '23505') throw this.rule('already_booked', 'Bạn đã đặt lớp này');
      throw e;
    }
  }

  /**
   * UC-08: hủy lượt đặt + đôn người chờ (BR5), tất cả trong MỘT transaction.
   * Khóa dòng lớp TRƯỚC (thứ tự lớp -> gói) và giữ đến hết transaction: chỗ vừa nhả
   * không bao giờ lộ ra cho người đặt mới khi còn người chờ (không chen hàng).
   */
  cancel(id: string, me: AuthUser) {
    return this.ds.transaction(async (m) => {
      const b = await m.findOneBy(Booking, { id });
      if (!b) throw new NotFoundException('Không tìm thấy lượt đặt');
      if (me.role === Role.MEMBER && b.memberId !== me.id) throw new ForbiddenException('Không đủ quyền truy cập');

      const cls = await m.findOne(GymClass, { where: { id: b.classId }, lock: { mode: 'pessimistic_write' } });
      if (!cls) throw new NotFoundException('Không tìm thấy lớp');
      if (cls.startTime.getTime() <= Date.now()) throw this.rule('class_started', 'Lớp đã bắt đầu, không thể hủy');
      // BR4: chỉ hội viên bị giới hạn hạn hủy; Quản lý hủy thay thì không
      if (me.role === Role.MEMBER && Date.now() > cls.startTime.getTime() - RULES.cancelCutoffMinutes * 60_000) {
        throw this.rule('cancel_window_closed',
          `Chỉ được hủy trước giờ học ${RULES.cancelCutoffMinutes / 60} giờ, vui lòng liên hệ Quản lý`);
      }

      const r = await m.createQueryBuilder().update(Booking)
        .set({ status: BookingStatus.CANCELLED, cancelledAt: () => 'NOW()' })
        .where('id = :id AND status = :st', { id, st: BookingStatus.CONFIRMED })
        .execute();
      if (!r.affected) throw this.rule('not_confirmed', 'Lượt đặt không còn ở trạng thái đã xác nhận');

      await this.release(m, b); // BR3: giải phóng chỗ trong lớp và buổi đang giữ trong gói
      const promoted = await this.promoteWaitlist(m, cls); // 4b (BR5)
      return { id, status: BookingStatus.CANCELLED, promoted };
    });
  }

  /** UC-09: mã QR của lượt đặt (nội dung = QR_PREFIX + bookingId, check-in ở bước sau sẽ đọc lại) */
  async getQr(id: string, me: AuthUser) {
    const b = await this.ds.manager.findOne(Booking, { where: { id }, relations: { gymClass: true } });
    if (!b) throw new NotFoundException('Không tìm thấy lượt đặt');
    if (b.memberId !== me.id) throw new ForbiddenException('Không đủ quyền truy cập');
    if (b.status !== BookingStatus.CONFIRMED) throw this.rule('not_confirmed', 'Lượt đặt không còn ở trạng thái đã xác nhận');
    if (b.gymClass.endTime.getTime() <= Date.now()) throw this.rule('class_ended', 'Lớp đã kết thúc');
    const payload = `${QR_PREFIX}${b.id}`;
    return { bookingId: b.id, payload, qrDataUrl: await QRCode.toDataURL(payload, { margin: 1, width: 320 }) };
  }

  /** UC-10: lịch sử đặt lớp. upcoming=true: chỉ lượt đã xác nhận của lớp chưa diễn ra (UC-09) */
  async listForMember(memberId: string, q: ListBookingsQuery) {
    if (!(await this.ds.manager.existsBy(MemberProfile, { userId: memberId }))) {
      throw new NotFoundException('Không tìm thấy hội viên');
    }
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const qb = this.ds.getRepository(Booking).createQueryBuilder('b')
      .innerJoinAndSelect('b.gymClass', 'c')
      .where('b.memberId = :memberId', { memberId })
      .skip((page - 1) * limit).take(limit);
    if (q.upcoming === 'true') {
      qb.andWhere('b.status = :cf AND c.startTime > NOW()', { cf: BookingStatus.CONFIRMED }).orderBy('c.startTime', 'ASC');
    } else {
      if (q.status) qb.andWhere('b.status = :status', { status: q.status });
      qb.orderBy('c.startTime', 'DESC');
    }
    const [rows, total] = await qb.getManyAndCount();
    return { items: rows.map((b) => this.view(b)), total, page, limit };
  }

  // ---------- nội bộ ----------
  /** Giải phóng chỗ lớp và chỗ giữ trong gói. Dùng cho hủy, sau này cho no-show và hủy lớp. */
  private async release(m: EntityManager, b: Booking) {
    const c = await m.createQueryBuilder().update(GymClass)
      .set({ confirmedCount: () => 'confirmed_count - 1' })
      .where('id = :id AND confirmed_count > 0', { id: b.classId }).execute();
    if (!c.affected) throw new Error('Bất biến (I1) bị phá: confirmed_count đã bằng 0 khi giải phóng chỗ');
    if (b.memberPackageId) {
      const p = await m.createQueryBuilder().update(MemberPackage)
        .set({ pendingCount: () => 'pending_count - 1' })
        .where('id = :id AND pending_count > 0', { id: b.memberPackageId }).execute();
      if (!p.affected) throw new Error('Bất biến (I2) bị phá: pending_count đã bằng 0 khi giải phóng chỗ');
    }
  }

  /**
   * BR5: đôn người chờ sớm nhất (FIFO) mà còn đủ điều kiện BR2. Mỗi người được thử trong một SAVEPOINT:
   * không đủ điều kiện thì rollback về savepoint (hoàn tác các cập nhật dở) rồi xét người kế tiếp.
   * Người bị bỏ qua vẫn giữ nguyên chỗ trong hàng. Trả về true nếu có người được đôn.
   */
  private async promoteWaitlist(m: EntityManager, cls: GymClass): Promise<boolean> {
    const waiting = await m.find(WaitlistEntry, {
      where: { classId: cls.id, status: WaitlistStatus.WAITING },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    for (const w of waiting) {
      await m.query('SAVEPOINT promote_try');
      let res: 'promoted' | 'skip' | 'full';
      try {
        res = await this.tryPromote(m, w, cls);
      } catch (e: any) {
        // chỉ nuốt lỗi trùng khóa; lỗi khác phải làm hỏng cả transaction
        if ((e?.code ?? e?.driverError?.code) !== '23505') throw e;
        res = 'skip';
      }
      if (res !== 'promoted') await m.query('ROLLBACK TO SAVEPOINT promote_try');
      await m.query('RELEASE SAVEPOINT promote_try');
      if (res === 'promoted') return true;
      if (res === 'full') return false;
    }
    return false;
  }

  private async tryPromote(m: EntityManager, w: WaitlistEntry, cls: GymClass): Promise<'promoted' | 'skip' | 'full'> {
    // BR2(a): tài khoản còn hoạt động
    if (!(await m.existsBy(User, { id: w.memberId, status: UserStatus.ACTIVE }))) return 'skip';
    // BR2(b): gói đang hoạt động và còn hiệu lực vào ngày diễn ra lớp
    const pkg = await m.findOneBy(MemberPackage, { memberId: w.memberId, status: MemberPackageStatus.ACTIVE });
    if (!pkg) return 'skip';
    const day = toVN(cls.startTime).date;
    if (pkg.startDate > day || (pkg.endDate && pkg.endDate < day)) return 'skip';
    // BR2(c): chưa có lượt đặt xác nhận cho lớp này
    if (await m.existsBy(Booking, { memberId: w.memberId, classId: cls.id, status: BookingStatus.CONFIRMED })) return 'skip';

    // (I1): P2. Không cập nhật được dòng nào = lớp không nhận thêm được nữa, dừng hẳn
    const c = await m.createQueryBuilder().update(GymClass)
      .set({ confirmedCount: () => 'confirmed_count + 1' })
      .where('id = :id AND status = :st AND start_time > NOW() AND confirmed_count < capacity',
        { id: cls.id, st: ClassStatus.SCHEDULED })
      .execute();
    if (!c.affected) return 'full';
    // (I2): P2
    const p = await m.createQueryBuilder().update(MemberPackage)
      .set({ pendingCount: () => 'pending_count + 1' })
      .where('id = :id AND status = :st AND (sessions_remaining IS NULL OR pending_count < sessions_remaining)',
        { id: pkg.id, st: MemberPackageStatus.ACTIVE })
      .execute();
    if (!p.affected) return 'skip'; // hết buổi: savepoint rollback sẽ trả lại bộ đếm lớp

    await m.save(Booking, m.create(Booking, { memberId: w.memberId, classId: cls.id, memberPackageId: pkg.id }));
    const u = await m.createQueryBuilder().update(WaitlistEntry)
      .set({ status: WaitlistStatus.PROMOTED, promotedAt: () => 'NOW()' })
      .where('id = :id AND status = :st', { id: w.id, st: WaitlistStatus.WAITING })
      .execute();
    if (!u.affected) return 'skip'; // người chờ vừa rời hàng: savepoint rollback hủy luôn các bước trên
    // TODO (thông báo FR-31): tạo Notification cho người được đôn
    return 'promoted';
  }

  private async explainClassRejection(m: EntityManager, classId: string) {
    const c = await m.findOneBy(GymClass, { id: classId });
    if (!c) return new NotFoundException('Không tìm thấy lớp');
    if (c.status !== ClassStatus.SCHEDULED) return this.rule('class_not_open', 'Lớp đã bị hủy hoặc đã kết thúc');
    if (c.startTime.getTime() <= Date.now()) return this.rule('class_started', 'Lớp đã bắt đầu');
    return this.rule('class_full', 'Lớp đã đủ sức chứa. Bạn có thể vào danh sách chờ');
  }

  private rule(type: string, message: string) {
    return new ConflictException({ message, type });
  }

  private view(b: Booking) {
    const c = b.gymClass;
    return {
      id: b.id, status: b.status, createdAt: b.createdAt, cancelledAt: b.cancelledAt, memberPackageId: b.memberPackageId,
      class: { id: c.id, title: c.title, startTime: c.startTime, endTime: c.endTime, status: c.status },
      cancellableUntil: b.status === BookingStatus.CONFIRMED
        ? new Date(c.startTime.getTime() - RULES.cancelCutoffMinutes * 60_000) : null,
    };
  }
}