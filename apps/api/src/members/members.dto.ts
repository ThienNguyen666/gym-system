import { Type } from 'class-transformer';
import { IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { UserStatus } from '../entities/enums';

export class CreateMemberDto {
  @IsEmail() email: string;
  @IsString() @IsNotEmpty() @MaxLength(100) fullName: string;
  @IsString() @MinLength(8) password: string;
}
export class UpdateMemberDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) fullName?: string;
}
export class SetMemberStatusDto { @IsEnum(UserStatus) status: UserStatus }
export class RegisterPackageDto { @IsUUID() packageId: string }

export class ListMembersQuery {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}