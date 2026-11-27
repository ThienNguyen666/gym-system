import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { UserStatus } from '../entities/enums';
import { RefreshToken } from '../entities/refresh-token.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(RefreshToken) private tokens: Repository<RefreshToken>,
    private jwt: JwtService,
    private cfg: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.users.findOneBy({ email: email.toLowerCase() });
    const ok = user && (await bcrypt.compare(password, user.passwordHash));
    if (!ok) throw new UnauthorizedException('Thông tin đăng nhập không đúng'); // không nói rõ sai trường nào
    if (user.status !== UserStatus.ACTIVE) throw new ForbiddenException('Tài khoản đã bị khóa');
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; jti: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, { secret: this.cfg.getOrThrow('JWT_REFRESH_SECRET') });
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }
    const row = await this.tokens.findOneBy({ id: payload.jti });
    if (!row || row.revokedAt) {
      if (row) await this.revokeAll(row.userId); // token cũ bị dùng lại => nghi bị lộ, thu hồi hết
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }
    row.revokedAt = new Date(); // xoay vòng: dùng một lần
    await this.tokens.save(row);
    const user = await this.users.findOneBy({ id: payload.sub });
    if (!user || user.status !== UserStatus.ACTIVE) throw new UnauthorizedException();
    return this.issueTokens(user);
  }

  async logout(refreshToken: string) {
    try {
      const p: { jti: string } = await this.jwt.verifyAsync(refreshToken, {
        secret: this.cfg.getOrThrow('JWT_REFRESH_SECRET'),
      });
      await this.tokens.update({ id: p.jti, revokedAt: IsNull() }, { revokedAt: new Date() });
    } catch { /* token hỏng thì coi như đã đăng xuất */ }
  }

  async changePassword(userId: string, current: string, next: string) {
    const user = await this.users.findOneByOrFail({ id: userId });
    if (!(await bcrypt.compare(current, user.passwordHash))) throw new BadRequestException('Mật khẩu hiện tại không đúng');
    user.passwordHash = await bcrypt.hash(next, 10);
    await this.users.save(user);
    await this.revokeAll(userId); // đổi mật khẩu thì đăng xuất mọi thiết bị
  }

  private revokeAll(userId: string) {
    return this.tokens.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  private async issueTokens(user: User) {
    const jti = randomUUID();
    const base = { sub: user.id, role: user.role };
    const accessToken = await this.jwt.signAsync(base, {
      secret: this.cfg.getOrThrow('JWT_ACCESS_SECRET'),
      expiresIn: this.cfg.get('JWT_ACCESS_TTL', '15m') as any,
    });
    const refreshToken = await this.jwt.signAsync({ ...base, jti }, {
      secret: this.cfg.getOrThrow('JWT_REFRESH_SECRET'),
      expiresIn: this.cfg.get('JWT_REFRESH_TTL', '7d') as any,
    });
    const { exp } = this.jwt.decode(refreshToken) as { exp: number };
    await this.tokens.save({ id: jti, userId: user.id, expiresAt: new Date(exp * 1000), revokedAt: null });
    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
    };
  }
}