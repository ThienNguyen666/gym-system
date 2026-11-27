export enum Role { ADMIN = 'admin', MANAGER = 'manager', TRAINER = 'trainer', MEMBER = 'member' }
export enum UserStatus { ACTIVE = 'active', DISABLED = 'disabled' }
export enum PackageType { DURATION = 'duration', SESSIONS = 'sessions' }
export enum MemberPackageStatus { PENDING = 'pending', ACTIVE = 'active', EXPIRED = 'expired', CANCELLED = 'cancelled' }
export enum ClassStatus { SCHEDULED = 'scheduled', CANCELLED = 'cancelled', COMPLETED = 'completed' }
export enum BookingStatus { CONFIRMED = 'confirmed', CANCELLED = 'cancelled', COMPLETED = 'completed', NO_SHOW = 'no_show' }
export enum WaitlistStatus { WAITING = 'waiting', PROMOTED = 'promoted', EXPIRED = 'expired', CANCELLED = 'cancelled' }
export enum CheckInMethod { QR = 'qr', MANUAL = 'manual' }
export enum PaymentMethod { CASH = 'cash', TRANSFER = 'transfer' }
export enum PaymentStatus { PAID = 'paid', REFUNDED = 'refunded' }