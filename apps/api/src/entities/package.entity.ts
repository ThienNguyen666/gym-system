import { Check, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { PackageType } from './enums';

@Entity('Packages')
@Check('chk_package_price', 'price >= 0')
export class Package {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Column({ type: 'enum', enum: PackageType }) type: PackageType;
  @Column('numeric', { precision: 12, scale: 2 }) price: string; // numeric -> string, đúng chủ ý
  @Column({ name: 'duration_days', type: 'int', nullable: true }) durationDays: number | null;
  @Column({ name: 'total_sessions', type: 'int', nullable: true }) totalSessions: number | null;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
}