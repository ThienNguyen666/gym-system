import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TrainerProfile } from './trainer-profile.entity';

@Entity('TrainerAvailability')
@Check('chk_avail_dow', 'day_of_week BETWEEN 0 AND 6')
export class TrainerAvailability {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid', { name: 'trainer_id' }) trainerId: string;
  @ManyToOne(() => TrainerProfile) @JoinColumn({ name: 'trainer_id' }) trainer: TrainerProfile;
  @Column({ name: 'day_of_week', type: 'int' }) dayOfWeek: number;
  @Column({ name: 'start_time', type: 'time' }) startTime: string;
  @Column({ name: 'end_time', type: 'time' }) endTime: string;
}