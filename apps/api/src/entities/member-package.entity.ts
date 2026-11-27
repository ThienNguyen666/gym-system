import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { MemberPackageStatus } from './enums';
import { MemberProfile } from './member-profile.entity';
import { Package } from './package.entity';

@Entity('MemberPackages')
@Check('chk_mp_sessions', 'sessions_remaining >= 0')
@Check('chk_mp_pending', 'pending_count >= 0 AND pending_count <= sessions_remaining') // bất biến (I2)
@Index('uq_member_one_active_package', ['memberId'], { unique: true, where: `"status" = 'active'` }) // BR1
export class MemberPackage {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid', { name: 'member_id' }) memberId: string;
  @ManyToOne(() => MemberProfile) @JoinColumn({ name: 'member_id' }) member: MemberProfile;
  @Column('uuid', { name: 'package_id' }) packageId: string;
  @ManyToOne(() => Package) @JoinColumn({ name: 'package_id' }) package: Package;
  @Column({ name: 'start_date', type: 'date' }) startDate: string;
  @Column({ name: 'end_date', type: 'date', nullable: true }) endDate: string | null;
  @Column({ name: 'sessions_remaining', type: 'int', nullable: true }) sessionsRemaining: number | null;
  @Column({ name: 'pending_count', type: 'int', default: 0 }) pendingCount: number;
  @Column({ type: 'enum', enum: MemberPackageStatus, default: MemberPackageStatus.PENDING }) status: MemberPackageStatus;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}