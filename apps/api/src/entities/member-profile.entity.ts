import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('MemberProfiles')
export class MemberProfile {
  @PrimaryColumn('uuid', { name: 'user_id' }) userId: string;
  @OneToOne(() => User) @JoinColumn({ name: 'user_id' }) user: User;
  @Column({ name: 'join_date', type: 'date' }) joinDate: string;
}