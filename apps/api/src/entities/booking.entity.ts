import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BookingStatus } from './enums';
import { GymClass } from './gym-class.entity';
import { MemberPackage } from './member-package.entity';
import { MemberProfile } from './member-profile.entity';

@Entity('Bookings')
@Index('uq_booking_member_class_confirmed', ['memberId', 'classId'], { unique: true, where: `"status" = 'confirmed'` })
@Index('idx_booking_class_status', ['classId', 'status'])
@Index('idx_booking_member', ['memberId'])
export class Booking {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid', { name: 'member_id' }) memberId: string;
  @ManyToOne(() => MemberProfile) @JoinColumn({ name: 'member_id' }) member: MemberProfile;
  @Column('uuid', { name: 'class_id' }) classId: string;
  @ManyToOne(() => GymClass) @JoinColumn({ name: 'class_id' }) gymClass: GymClass;
  // gói đang giữ buổi cho lượt đặt này, cần để giải phóng pending_count khi hủy/no-show
  @Column('uuid', { name: 'member_package_id', nullable: true }) memberPackageId: string | null;
  @ManyToOne(() => MemberPackage, { nullable: true }) @JoinColumn({ name: 'member_package_id' }) memberPackage: MemberPackage | null;
  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.CONFIRMED }) status: BookingStatus;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true }) cancelledAt: Date | null;
}