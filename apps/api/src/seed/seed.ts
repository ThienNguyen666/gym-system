import * as bcrypt from 'bcryptjs';
import dataSource from '../data-source';
import { ClassStatus, MemberPackageStatus, PackageType, PaymentMethod, Role } from '../entities/enums';
import { GymClass } from '../entities/gym-class.entity';
import { MemberPackage } from '../entities/member-package.entity';
import { MemberProfile } from '../entities/member-profile.entity';
import { Package } from '../entities/package.entity';
import { Payment } from '../entities/payment.entity';
import { TrainerProfile } from '../entities/trainer-profile.entity';
import { User } from '../entities/user.entity';

const PASSWORD = 'Passw0rd!';
const iso = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  await dataSource.initialize();
  const m = dataSource.manager;
  if ((await m.count(User)) > 0) { console.log('DB đã có dữ liệu, bỏ qua seed.'); return; }
  const hash = await bcrypt.hash(PASSWORD, 10);

  const mkUser = (email: string, fullName: string, role: Role) =>
    m.save(User, m.create(User, { email, fullName, role, passwordHash: hash }));

  const admin = await mkUser('admin@gym.local', 'Quản trị viên', Role.ADMIN);
  const manager = await mkUser('manager@gym.local', 'Quản lý Gym', Role.MANAGER);

  const trainers: TrainerProfile[] = [];
  for (const [i, spec] of ['Yoga', 'HIIT', 'Strength'].entries()) {
    const u = await mkUser(`trainer${i + 1}@gym.local`, `HLV ${spec}`, Role.TRAINER);
    trainers.push(await m.save(TrainerProfile, { userId: u.id, specialization: spec }));
  }

  const monthly = await m.save(Package, m.create(Package, {
    name: 'Gói 1 tháng', type: PackageType.DURATION, price: '500000', durationDays: 30, totalSessions: null,
  }));
  const tenSessions = await m.save(Package, m.create(Package, {
    name: 'Gói 10 buổi', type: PackageType.SESSIONS, price: '800000', durationDays: null, totalSessions: 10,
  }));

  const today = new Date();
  for (let i = 1; i <= 8; i++) {
    const u = await mkUser(`member${i}@gym.local`, `Hội viên ${i}`, Role.MEMBER);
    await m.save(MemberProfile, { userId: u.id, joinDate: iso(today) });
    const pkg = i % 2 ? monthly : tenSessions;
    const end = new Date(today); end.setDate(end.getDate() + 30);
    const mp = await m.save(MemberPackage, m.create(MemberPackage, {
      memberId: u.id, packageId: pkg.id, startDate: iso(today),
      endDate: pkg.type === PackageType.DURATION ? iso(end) : null,
      sessionsRemaining: pkg.totalSessions, pendingCount: 0, status: MemberPackageStatus.ACTIVE,
    }));
    await m.save(Payment, m.create(Payment, {
      memberPackageId: mp.id, amount: pkg.price, method: PaymentMethod.CASH,
      paidAt: new Date(), recordedBy: manager.id,
    }));
  }

  // 6 lớp trong 3 ngày tới; lớp đầu sức chứa 2 để dễ thử "lớp đầy + waitlist"
  for (let d = 1; d <= 3; d++) {
    for (const [slot, hour] of [[0, 7], [1, 18]] as const) {
      const start = new Date(today); start.setDate(start.getDate() + d); start.setHours(hour, 0, 0, 0);
      const end = new Date(start); end.setHours(hour + 1);
      await m.save(GymClass, m.create(GymClass, {
        title: `${['Yoga', 'HIIT', 'Strength'][(d + slot) % 3]} ${hour}h`,
        trainerId: trainers[(d + slot) % 3].userId,
        startTime: start, endTime: end,
        capacity: d === 1 && slot === 1 ? 2 : 15,
        status: ClassStatus.SCHEDULED,
      }));
    }
  }
  console.log(`Seed xong. Mật khẩu mọi tài khoản: ${PASSWORD}`);
  console.log('admin@gym.local | manager@gym.local | trainer1..3@gym.local | member1..8@gym.local');
}

main().finally(() => dataSource.destroy());