import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { AssetCondition } from '../../generated/prisma/enums.js';

export class CreateAssetTransferDto {
  @IsUUID()
  destinationLocationId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  assetIds!: string[];

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class ReceiveAssetTransferLineDto {
  @IsIn(['RECEIVED', 'MISSING', 'REJECTED'])
  result!: 'RECEIVED' | 'MISSING' | 'REJECTED';

  @ValidateIf(
    (value: ReceiveAssetTransferLineDto) => value.result === 'RECEIVED',
  )
  @IsEnum(AssetCondition)
  conditionAtReceipt?: AssetCondition;

  @ValidateIf(
    (value: ReceiveAssetTransferLineDto) => value.result === 'RECEIVED',
  )
  @Transform(({ value }) =>
    value === 'true' || value === 'false' ? value === 'true' : value,
  )
  @IsBoolean()
  inspectionRequired?: boolean;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(1000)
  exceptionNote?: string;
}
