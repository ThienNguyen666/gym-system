import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('RefreshTokens')
export class RefreshToken {
  @PrimaryColumn('uuid') id: string; // = jti trong JWT
  @Column('uuid', { name: 'user_id' }) userId: string;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt: Date;
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true }) revokedAt: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}