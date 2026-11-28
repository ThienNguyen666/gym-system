import { ForbiddenException } from '@nestjs/common';
import { Role } from '../entities/enums';
import type { AuthUser } from './decorators';

/** Hội viên chỉ được đụng dữ liệu của chính mình (NFR-04); Quản lý được đụng mọi hội viên. */
export function assertSelfOrManager(me: AuthUser, memberId: string) {
  if (me.role === Role.MANAGER) return;
  if (me.role === Role.MEMBER && me.id === memberId) return;
  throw new ForbiddenException('Không đủ quyền truy cập');
}

/** Quản lý, hoặc chính Huấn luyện viên đó */
export function assertTrainerSelfOrManager(me: AuthUser, trainerId: string) {
  if (me.role === Role.MANAGER) return;
  if (me.role === Role.TRAINER && me.id === trainerId) return;
  throw new ForbiddenException('Không đủ quyền truy cập');
}

/** Chỉ chính Huấn luyện viên đó (khung giờ rảnh do HLV tự khai báo) */
export function assertTrainerSelf(me: AuthUser, trainerId: string) {
  if (me.role === Role.TRAINER && me.id === trainerId) return;
  throw new ForbiddenException('Không đủ quyền truy cập');
}