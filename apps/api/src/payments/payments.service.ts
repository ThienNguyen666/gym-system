import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { addDays, todayVN } from '../common/date';
import type { AuthUser } from '../common/decorators';
import { MemberPackageStatus, PackageType, PaymentStatus } from '../entities/enums';
import { MemberPackage } from '../entities/member-package.entity';
import { MemberProfile } from '../entities/member-profile.entity';
import { Payment } from '../entities/payment.entity';
import { CreatePaymentDto } from './payments.dto';

@Injectable()
export class PaymentsService {
  constructor(private ds: DataSource) {}

  /**
   * UC-19 bước 2 (BR8): ghi thanh toán và kích hoạt gói trong MỘT transaction.
   * Khóa dòng hội viên để các thanh toán của cùng một hội viên chạy lần lượt:
   * tránh hai gói cùng được kích hoạt (vi phạm BR1 / uq_member_one_active_package).
   */
  record(d: CreatePaymentDto, me: AuthUser) {
    return this.ds.transaction(async (m) => {
      const ref = await m.findOneBy(MemberPackage, { id: d.memberPackageId });
      if (!ref) throw new NotFoundException('Không tìm thấy gói đăng ký');
      await m.findOne(MemberProfile, { where: { userId: ref.memberId }, lock: { mode: 'pessimistic_write' } });

      // đọc lại SAU khi giữ khóa: trạng thái có thể đã đổi trong lúc chờ
      const mp = await m.findOne(MemberPackage, { where: { id: d.memberPackageId }, relations: { package: true } });
      if (!mp) throw new NotFoundException('Không tìm thấy gói đăng ký');
      if (mp.status !== MemberPackageStatus.PENDING) throw new ConflictException('Gói không ở trạng thái chờ thanh toán');
      if (await m.existsBy(Payment, { memberPackageId: mp.id })) throw new ConflictException('Gói này đã được thanh toán');

      const payment = await m.save(Payment, m.create(Payment, {
        memberPackageId: mp.id, amount: d.amount.toFixed(2), method: d.method,
        paidAt: new Date(), recordedBy: me.id,
      }));

      // Hội viên đã có gói active thì gói mới xếp hàng (BR1), Scheduler sẽ kích hoạt sau
      const hasActive = await m.existsBy(MemberPackage, { memberId: mp.memberId, status: MemberPackageStatus.ACTIVE });
      let { startDate, endDate } = mp;
      let status: MemberPackageStatus = mp.status;
      if (!hasActive) {
        startDate = todayVN();
        endDate = mp.package.type === PackageType.DURATION ? addDays(startDate, mp.package.durationDays!) : null;
        status = MemberPackageStatus.ACTIVE;
        await m.update(MemberPackage, mp.id, { startDate, endDate, status });
      }
      
      return {
        payment: { id: payment.id, amount: payment.amount, method: payment.method, status: payment.status, paidAt: payment.paidAt },
        memberPackage: { id: mp.id, status, startDate, endDate, sessionsRemaining: mp.sessionsRemaining },
        activated: !hasActive,
      };
    });
  }

  /** FR-27: hoàn tiền; không cho hoàn khi gói còn lượt đặt đang giữ chỗ */
  refund(id: string) {
    return this.ds.transaction(async (m) => {
      const ref = await m.findOneBy(Payment, { id });
      if (!ref) throw new NotFoundException('Không tìm thấy thanh toán');
      const mpRef = await m.findOneByOrFail(MemberPackage, { id: ref.memberPackageId });
      await m.findOne(MemberProfile, { where: { userId: mpRef.memberId }, lock: { mode: 'pessimistic_write' } });

      const pay = await m.findOneByOrFail(Payment, { id });
      if (pay.status === PaymentStatus.REFUNDED) throw new ConflictException('Thanh toán đã được hoàn tiền');
      const mp = await m.findOneByOrFail(MemberPackage, { id: pay.memberPackageId });
      if (mp.pendingCount > 0) throw new ConflictException('Gói còn lượt đặt đang giữ chỗ, hãy hủy các lượt đặt trước');

      await m.update(Payment, id, { status: PaymentStatus.REFUNDED });
      if (mp.status === MemberPackageStatus.ACTIVE || mp.status === MemberPackageStatus.PENDING) {
        await m.update(MemberPackage, mp.id, { status: MemberPackageStatus.CANCELLED });
      }
      return { id, status: PaymentStatus.REFUNDED, memberPackageStatus: MemberPackageStatus.CANCELLED };
    });
  }
}