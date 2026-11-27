import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Role, UserStatus } from './enums';

@Entity('Users')
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) email: string;
  @Column({ name: 'password_hash' }) passwordHash: string;
  @Column({ name: 'full_name' }) fullName: string;
  @Column({ type: 'enum', enum: Role }) role: Role;
  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE }) status: UserStatus;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}