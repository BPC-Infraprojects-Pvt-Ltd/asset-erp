import { Transform } from 'class-transformer';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import {
  SoftwareCommercialClassification,
  SoftwarePolicyStatus,
} from '../../generated/prisma/enums.js';

export class UpdateSoftwareProductDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  publisher!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @IsEnum(SoftwareCommercialClassification)
  commercialClassification!: SoftwareCommercialClassification;

  @IsEnum(SoftwarePolicyStatus)
  policyStatus!: SoftwarePolicyStatus;
}
