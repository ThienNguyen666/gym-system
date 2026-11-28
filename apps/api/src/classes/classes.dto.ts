import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export class CreateClassDto {
  @IsString() @IsNotEmpty() @MaxLength(100) title: string;
  @IsDateString() startTime: string;
  @IsDateString() endTime: string;
  @IsInt() @Min(1) @Max(200) capacity: number;
  @IsOptional() @IsUUID() trainerId?: string;
}
export class UpdateClassDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) title?: string;
  @IsOptional() @IsDateString() startTime?: string;
  @IsOptional() @IsDateString() endTime?: string;
  @IsOptional() @IsInt() @Min(1) @Max(200) capacity?: number;
  @IsOptional() @IsUUID() trainerId?: string | null; // null = bỏ phân công
}
export class AssignTrainerDto {
  @ValidateIf((o) => o.trainerId !== null) @IsUUID() trainerId: string | null;
}
export class ListClassesQuery {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsUUID() trainerId?: string;
}