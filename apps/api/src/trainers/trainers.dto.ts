import { Type } from 'class-transformer';
import { IsDateString, IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { UserStatus } from '../entities/enums';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateTrainerDto {
  @IsEmail() email: string;
  @IsString() @IsNotEmpty() @MaxLength(100) fullName: string;
  @IsString() @MinLength(8) password: string;
  @IsOptional() @IsString() @MaxLength(100) specialization?: string;
}
export class UpdateTrainerDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) fullName?: string;
  @IsOptional() @IsString() @MaxLength(100) specialization?: string;
}
export class SetTrainerStatusDto { @IsEnum(UserStatus) status: UserStatus }

export class CreateSlotDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(6) dayOfWeek: number;
  @Matches(HHMM, { message: 'startTime phải có dạng HH:mm' }) startTime: string;
  @Matches(HHMM, { message: 'endTime phải có dạng HH:mm' }) endTime: string;
}
export class UpdateSlotDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(6) dayOfWeek?: number;
  @IsOptional() @Matches(HHMM) startTime?: string;
  @IsOptional() @Matches(HHMM) endTime?: string;
}
export class ListTrainerClassesQuery {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}