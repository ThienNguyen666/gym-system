import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Role, UserStatus } from '../entities/enums';
import { User } from '../entities/user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  async createManager(email: string, fullName: string, password: string) {
    email = email.toLowerCase();
    if (await this.repo.existsBy({ email })) throw new ConflictException('Email đã được sử dụng');
    const u = await this.repo.save(this.repo.create({
      email, fullName, role: Role.MANAGER, passwordHash: await bcrypt.hash(password, 10),
    }));
    return this.safe(u);
  }

  async list(role?: Role, status?: UserStatus) {
    const where: FindOptionsWhere<User> = {};
    if (role) where.role = role;
    if (status) where.status = status;
    const rows = await this.repo.find({ where, order: { createdAt: 'DESC' } });
    return rows.map((u) => this.safe(u));
  }

  async setStatus(id: string, status: UserStatus, actorId: string) {
    if (id === actorId) throw new BadRequestException('Không thể tự khóa tài khoản của mình');
    const u = await this.repo.findOneBy({ id });
    if (!u) throw new NotFoundException();
    u.status = status;
    return this.safe(await this.repo.save(u));
  }

  private safe({ passwordHash, ...rest }: User) { return rest; }
}