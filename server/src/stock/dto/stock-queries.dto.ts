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
} from 'class-validator';
import { StockMovementType } from '../../generated/prisma/enums.js';

export class ListStockItemsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class ListStockMovementsQueryDto extends ListStockItemsQueryDto {
  @IsOptional()
  @IsUUID()
  stockItemId?: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsEnum(StockMovementType)
  movementType?: StockMovementType;
}

export class ListStockReservationsQueryDto extends ListStockItemsQueryDto {
  @IsOptional()
  @IsUUID()
  stockItemId?: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;
}
