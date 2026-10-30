import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { StockMovementType } from '../../generated/prisma/enums.js';

export class CreateStockMovementDto {
  @IsEnum(StockMovementType)
  movementType!: StockMovementType;

  @IsOptional()
  @IsUUID()
  sourceStoreId?: string;

  @IsOptional()
  @IsUUID()
  destinationStoreId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  quantity!: number;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(150)
  sourceReference?: string;
}
