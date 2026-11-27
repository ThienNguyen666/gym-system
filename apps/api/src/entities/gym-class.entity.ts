import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ClassStatus } from './enums';
import { TrainerProfile } from './trainer-profile.entity';

@Entity('GymClasses')
@Check('chk_class_capacity', 'capacity > 0')
@Check('chk_class_time', 'end_time > start_time')
@Check('chk_class_confirmed', 'confirmed_count >= 0 AND confirmed_count <= capacity') // bất biến (I1)
@Index('idx_class_start', ['startTime'])
export class GymClass {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() title: string;
  @Column('uuid', { name: 'trainer_id', nullable: true }) trainerId: string | null;
  @ManyToOne(() => TrainerProfile, { nullable: true }) @JoinColumn({ name: 'trainer_id' }) trainer: TrainerProfile | null;
  @Column({ name: 'start_time', type: 'timestamptz' }) startTime: Date;
  @Column({ name: 'end_time', type: 'timestamptz' }) endTime: Date;
  @Column({ type: 'int' }) capacity: number;
  @Column({ name: 'confirmed_count', type: 'int', default: 0 }) confirmedCount: number;
  @Column({ type: 'enum', enum: ClassStatus, default: ClassStatus.SCHEDULED }) status: ClassStatus;
}