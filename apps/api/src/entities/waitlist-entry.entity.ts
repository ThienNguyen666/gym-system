import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { WaitlistStatus } from './enums';
import { GymClass } from './gym-class.entity';
import { MemberProfile } from './member-profile.entity';

@Entity('WaitlistEntries')
@Index('uq_waitlist_member_class_waiting', ['memberId', 'classId'], { unique: true, where: `"status" = 'waiting'` })
@Index('idx_waitlist_class_status_created', ['classId', 'status', 'createdAt'])
export class WaitlistEntry {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid', { name: 'member_id' }) memberId: string;
  @ManyToOne(() => MemberProfile) @JoinColumn({ name: 'member_id' }) member: MemberProfile;
  @Column('uuid', { name: 'class_id' }) classId: string;
  @ManyToOne(() => GymClass) @JoinColumn({ name: 'class_id' }) gymClass: GymClass;
  @Column({ type: 'enum', enum: WaitlistStatus, default: WaitlistStatus.WAITING }) status: WaitlistStatus;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @Column({ name: 'promoted_at', type: 'timestamptz', nullable: true }) promotedAt: Date | null;
}