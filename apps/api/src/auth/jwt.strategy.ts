import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { UserStatus } from '../entities/enums';
import { User } from '../entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(cfg: ConfigService, @InjectRepository(User) private users: Repository<User>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: cfg.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }
  // Vai trò lấy từ DB mỗi request: khóa tài khoản / đổi vai trò có hiệu lực ngay
  async validate(p: { sub: string }) {
    const u = await this.users.findOneBy({ id: p.sub });
    if (!u || u.status !== UserStatus.ACTIVE) throw new UnauthorizedException();
    return { id: u.id, role: u.role, email: u.email, fullName: u.fullName };
  }
}