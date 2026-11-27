import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Booking } from './booking.entity';
import { CheckInMethod } from './enums';
import { User } from './user.entity';

@Entity('CheckIns')
export class CheckIn {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid', { name: 'booking_id', unique: true }) bookingId: string; // tối đa 1 check-in / lượt đặt
  @OneToOne(() => Booking) @JoinColumn({ name: 'booking_id' }) booking: Booking;
  @Column({ name: 'checked_in_at', type: 'timestamptz' }) checkedInAt: Date;
  @Column('uuid', { name: 'checked_in_by' }) checkedInBy: string;
  @ManyToOne(() => User) @JoinColumn({ name: 'checked_in_by' }) checker: User;
  @Column({ type: 'enum', enum: CheckInMethod }) method: CheckInMethod;
}