import { ForbiddenException } from '@nestjs/common';
import { Role } from '../entities/enums';
import type { AuthUser } from './decorators';

/** Hội viên chỉ được đụng dữ liệu của chính mình (NFR-04); Quản lý được đụng mọi hội viên. */
export function assertSelfOrManager(me: AuthUser, memberId: string) {
  if (me.role === Role.MANAGER) return;
  if (me.role === Role.MEMBER && me.id === memberId) return;
  throw new ForbiddenException('Không đủ quyền truy cập');
}