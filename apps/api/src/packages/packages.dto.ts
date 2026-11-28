import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateIf } from 'class-validator';
import { PackageType } from '../entities/enums';

export class CreatePackageDto {
  @IsString() @IsNotEmpty() name: string;
  @IsEnum(PackageType) type: PackageType;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) price: number;
  @ValidateIf((o) => o.type === PackageType.DURATION) @IsInt() @Min(1) durationDays?: number;
  @ValidateIf((o) => o.type === PackageType.SESSIONS) @IsInt() @Min(1) totalSessions?: number;
}

// Chỉ cho sửa tên, giá, trạng thái bán. Không đổi loại/thông số của gói đã bán.
export class UpdatePackageDto {
  @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) price?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}