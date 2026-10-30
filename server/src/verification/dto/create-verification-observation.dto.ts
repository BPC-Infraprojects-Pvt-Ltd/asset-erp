import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { AssetCondition } from '../../generated/prisma/enums.js';

export class CreateVerificationObservationDto {
  @IsBoolean()
  found!: boolean;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  observedTag?: string;

  @IsOptional()
  @IsUUID()
  observedLocationId?: string;

  @IsOptional()
  @IsUUID()
  observedCustodianId?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(150)
  observedCustodianNumber?: string;

  @IsOptional()
  @IsEnum(AssetCondition)
  observedCondition?: AssetCondition;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
