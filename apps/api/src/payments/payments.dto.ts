import { IsEnum, IsNumber, IsPositive, IsUUID, Max } from 'class-validator';
import { PaymentMethod } from '../entities/enums';

export class CreatePaymentDto {
  @IsUUID() memberPackageId: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() @Max(1_000_000_000) amount: number;
  @IsEnum(PaymentMethod) method: PaymentMethod;
}