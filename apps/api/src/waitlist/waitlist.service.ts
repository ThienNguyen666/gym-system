import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { toVN } from '../common/date';
import type { AuthUser } from '../common/decorators';
import { ruleError } from '../common/errors';
import { Booking } from '../entities/booking.entity';
import { BookingStatus, ClassStatus, MemberPackageStatus, Role, WaitlistStatus } from '../entities/enums';
import { GymClass } from '../entities/gym-class.entity';
import { MemberPackage } from '../entities/member-package.entity';
import { MemberProfile } from '../entities/member-profile.entity';
import { WaitlistEntry } from '../entities/waitlist-entry.entity';

// Vị trí tính trong SQL (so sánh cả created_at và id) vì Date của JS chỉ có độ chính xác mili giây
const POSITION_SQL = `
  SELECT count(*)::int AS pos
  FROM "WaitlistEntries" w2
  JOIN "WaitlistEntries" w ON w.id = $1
  WHERE w2.class_id = w.class_id AND w2.status = 'waiting'
    AND (w2.created_at, w2.id) <= (w.created_at, w.id)`;

@Injectable()
export class WaitlistService {
  constructor(private ds: DataSource) {}

  /**
   * UC-06 (BR5): chỉ vào hàng chờ khi lớp ĐANG đầy. Đọc dòng lớp với FOR SHARE: hủy lượt đặt (FOR UPDATE)
   * phải chờ ta ghi xong mục chờ, nên không bao giờ có người chờ khi lớp còn chỗ.
   */
  async join(classId: string, me: AuthUser) {
    try {
      return await this.ds.transaction(async (m) => {
        const cls = await m.findOne(GymClass, { where: { id: classId }, lock: { mode: 'pessimistic_read' } });
        if (!cls) throw new NotFoundException('Không tìm thấy lớp');
        if (cls.status !== ClassStatus.SCHEDULED) throw ruleError('class_not_open', 'Lớp đã bị hủy hoặc đã kết thúc');
        if (cls.startTime.getTime() <= Date.now()) throw ruleError('waitlist_closed', 'Lớp đã bắt đầu, danh sách chờ đã đóng');
        if (cls.confirmedCount < cls.capacity) throw ruleError('class_has_spots', 'Lớp vừa có chỗ, hãy đặt lớp trực tiếp');

        // BR2(b), (c), (f): cùng điều kiện như đặt lớp, trừ (e) sức chứa
        const pkg = await m.findOneBy(MemberPackage, { memberId: me.id, status: MemberPackageStatus.ACTIVE });
        if (!pkg) throw ruleError('no_active_package', 'Bạn chưa có gói tập đang hoạt động');
        const day = toVN(cls.startTime).date;
        if (pkg.startDate > day || (pkg.endDate && pkg.endDate < day)) {
          throw ruleError('package_not_valid_on_class_date', 'Gói tập không còn hiệu lực vào ngày diễn ra lớp');
        }
        if (pkg.sessionsRemaining !== null && pkg.pendingCount >= pkg.sessionsRemaining) {
          throw ruleError('sessions_exhausted', 'Gói đã giữ chỗ hết số buổi còn lại');
        }
        if (await m.existsBy(Booking, { memberId: me.id, classId, status: BookingStatus.CONFIRMED })) {
          throw ruleError('already_booked', 'Bạn đã đặt lớp này');
        }
        if (await m.existsBy(WaitlistEntry, { memberId: me.id, classId, status: WaitlistStatus.WAITING })) {
          throw ruleError('already_waiting', 'Bạn đã ở trong danh sách chờ của lớp này');
        }

        const e = await m.save(WaitlistEntry, m.create(WaitlistEntry, { memberId: me.id, classId }));
        const rows = await m.query(POSITION_SQL, [e.id]);
        return { id: e.id, classId, status: e.status, position: rows[0].pos as number, createdAt: e.createdAt };
      });
    } catch (e: any) {
      // hai yêu cầu cùng (hội viên, lớp) chạy đồng thời: partial unique index chặn
      if ((e?.code ?? e?.driverError?.code) === '23505') throw ruleError('already_waiting', 'Bạn đã ở trong danh sách chờ của lớp này');
      throw e;
    }
  }

  /** UC-07: rời hàng chờ. Cập nhật có điều kiện: nếu vừa được đôn thành lượt đặt thì bị từ chối */
  async leave(id: string, me: AuthUser) {
    const w = await this.ds.manager.findOneBy(WaitlistEntry, { id });
    if (!w) throw new NotFoundException('Không tìm thấy mục chờ');
    if (w.memberId !== me.id) throw new ForbiddenException('Không đủ quyền truy cập');
    const r = await this.ds.createQueryBuilder().update(WaitlistEntry)
      .set({ status: WaitlistStatus.CANCELLED })
      .where('id = :id AND status = :st', { id, st: WaitlistStatus.WAITING })
      .execute();
    if (!r.affected) {
      throw ruleError('not_waiting', 'Mục chờ không còn hiệu lực (đã được đôn thành lượt đặt hoặc đã rời)');
    }
    return { id, status: WaitlistStatus.CANCELLED };
  }

  /** Các mục chờ đang hiệu lực của một hội viên, kèm vị trí hiện tại trong hàng */
  async listForMember(memberId: string) {
    if (!(await this.ds.manager.existsBy(MemberProfile, { userId: memberId }))) {
      throw new NotFoundException('Không tìm thấy hội viên');
    }
    return this.ds.query(`
      SELECT x.id, x.class_id AS "classId", x.created_at AS "createdAt", x.position::int AS position,
             c.title, c.start_time AS "startTime", c.end_time AS "endTime"
      FROM (
        SELECT w.id, w.class_id, w.member_id, w.created_at,
               row_number() OVER (PARTITION BY w.class_id ORDER BY w.created_at, w.id) AS position
        FROM "WaitlistEntries" w WHERE w.status = 'waiting'
      ) x
      JOIN "GymClasses" c ON c.id = x.class_id
      WHERE x.member_id = $1
      ORDER BY c.start_time`, [memberId]);
  }

  /** Hàng chờ của một lớp theo thứ tự FIFO. Quản lý xem mọi lớp, HLV chỉ xem lớp mình phụ trách */
  async listForClass(classId: string, me: AuthUser) {
    const cls = await this.ds.manager.findOneBy(GymClass, { id: classId });
    if (!cls) throw new NotFoundException('Không tìm thấy lớp');
    if (me.role === Role.TRAINER && cls.trainerId !== me.id) throw new ForbiddenException('Không đủ quyền truy cập');
    return this.ds.query(`
      SELECT w.id, w.member_id AS "memberId", u.full_name AS "fullName", w.created_at AS "createdAt",
             row_number() OVER (ORDER BY w.created_at, w.id)::int AS position
      FROM "WaitlistEntries" w
      JOIN "Users" u ON u.id = w.member_id
      WHERE w.class_id = $1 AND w.status = 'waiting'
      ORDER BY position`, [classId]);
  }
}