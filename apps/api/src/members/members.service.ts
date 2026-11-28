import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import { todayVN } from '../common/date';
import { MemberPackageStatus, PackageType, Role, UserStatus } from '../entities/enums';
import { MemberPackage } from '../entities/member-package.entity';
import { MemberProfile } from '../entities/member-profile.entity';
import { Package } from '../entities/package.entity';
import { Payment } from '../entities/payment.entity';
import { User } from '../entities/user.entity';
import { CreateMemberDto, ListMembersQuery, UpdateMemberDto } from './members.dto';

@Injectable()
export class MembersService {
  constructor(private ds: DataSource) {}

  /** UC-16: tạo hồ sơ + tài khoản Hội viên trong một transaction (BR14) */
  async create(d: CreateMemberDto) {
    const email = d.email.toLowerCase();
    const passwordHash = await bcrypt.hash(d.password, 10);
    try {
      return await this.ds.transaction(async (m) => {
        if (await m.existsBy(User, { email })) throw new ConflictException('Email đã được sử dụng');
        const u = await m.save(User, m.create(User, {
          email, fullName: d.fullName.trim(), role: Role.MEMBER, passwordHash,
        }));
        const profile = await m.save(MemberProfile, { userId: u.id, joinDate: todayVN() });
        return this.view(u, profile.joinDate);
      });
    } catch (e: any) {
      // hai yêu cầu cùng email chạy đồng thời: ràng buộc unique của DB chặn
      if ((e?.code ?? e?.driverError?.code) === '23505') throw new ConflictException('Email đã được sử dụng');
      throw e;
    }
  }

  async list(q: ListMembersQuery) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const qb = this.ds.getRepository(MemberProfile).createQueryBuilder('mp')
      .innerJoinAndSelect('mp.user', 'u')
      .orderBy('mp.joinDate', 'DESC').addOrderBy('u.fullName', 'ASC')
      .skip((page - 1) * limit).take(limit);
    if (q.status) qb.andWhere('u.status = :status', { status: q.status });
    if (q.search) qb.andWhere('(u.fullName ILIKE :s OR u.email ILIKE :s)', { s: `%${q.search}%` });
    const [rows, total] = await qb.getManyAndCount();
    return { items: rows.map((p) => this.view(p.user, p.joinDate)), total, page, limit };
  }

  async get(id: string) {
    const p = await this.findProfile(id);
    return this.view(p.user, p.joinDate);
  }

  async update(id: string, d: UpdateMemberDto) {
    const p = await this.findProfile(id);
    if (d.fullName !== undefined) {
      p.user.fullName = d.fullName.trim();
      await this.ds.manager.save(User, p.user);
    }
    return this.view(p.user, p.joinDate);
  }

  /** Chỉ đổi được trạng thái của Hội viên (id Huấn luyện viên/Quản lý sẽ ra 404) */
  async setStatus(id: string, status: UserStatus) {
    const p = await this.findProfile(id);
    p.user.status = status;
    await this.ds.manager.save(User, p.user);
    return this.view(p.user, p.joinDate);
  }

  async listPackages(memberId: string) {
    await this.findProfile(memberId);
    return this.ds.manager.find(MemberPackage, {
      where: { memberId }, relations: { package: true }, order: { createdAt: 'DESC' },
    });
  }

  /** UC-19 bước 1: tạo gói chờ thanh toán, trả số tiền cần thu */
  async registerPackage(memberId: string, packageId: string) {
    const em = this.ds.manager;
    const p = await this.findProfile(memberId);
    if (p.user.status !== UserStatus.ACTIVE) throw new BadRequestException('Hội viên đang bị khóa');
    const pkg = await em.findOneBy(Package, { id: packageId });
    if (!pkg || !pkg.isActive) throw new BadRequestException('Gói không tồn tại hoặc đã ngừng bán');
    const mp = await em.save(MemberPackage, em.create(MemberPackage, {
      memberId,
      packageId,
      startDate: todayVN(), // sẽ được tính lại khi thanh toán và kích hoạt
      endDate: null,
      sessionsRemaining: pkg.type === PackageType.SESSIONS ? pkg.totalSessions : null,
      pendingCount: 0,
      status: MemberPackageStatus.PENDING,
    }));
    return {
      memberPackage: { id: mp.id, status: mp.status, packageId, sessionsRemaining: mp.sessionsRemaining },
      amountDue: pkg.price,
    };
  }

  async listPayments(memberId: string) {
    await this.findProfile(memberId);
    return this.ds.getRepository(Payment).createQueryBuilder('p')
      .innerJoinAndSelect('p.memberPackage', 'mp')
      .innerJoinAndSelect('mp.package', 'pk')
      .where('mp.memberId = :memberId', { memberId })
      .orderBy('p.paidAt', 'DESC')
      .getMany();
  }

  private async findProfile(id: string) {
    const p = await this.ds.manager.findOne(MemberProfile, { where: { userId: id }, relations: { user: true } });
    if (!p) throw new NotFoundException('Không tìm thấy hội viên');
    return p;
  }

  private view(u: User, joinDate: string) {
    return { id: u.id, email: u.email, fullName: u.fullName, status: u.status, joinDate };
  }
}