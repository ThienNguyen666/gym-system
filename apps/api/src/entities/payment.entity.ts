import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { PaymentMethod, PaymentStatus } from './enums';
import { MemberPackage } from './member-package.entity';
import { User } from './user.entity';

@Entity('Payments')
@Check('chk_payment_amount', 'amount > 0')
export class Payment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid', { name: 'member_package_id' }) memberPackageId: string;
  @ManyToOne(() => MemberPackage) @JoinColumn({ name: 'member_package_id' }) memberPackage: MemberPackage;
  @Column('numeric', { precision: 12, scale: 2 }) amount: string;
  @Column({ type: 'enum', enum: PaymentMethod }) method: PaymentMethod;
  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PAID }) status: PaymentStatus;
  @Column({ name: 'paid_at', type: 'timestamptz' }) paidAt: Date;
  @Column('uuid', { name: 'recorded_by' }) recordedBy: string;
  @ManyToOne(() => User) @JoinColumn({ name: 'recorded_by' }) recorder: User;
}