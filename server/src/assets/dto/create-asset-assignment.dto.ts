import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  AssetCondition,
  AssignmentRecipientType,
} from '../../generated/prisma/enums.js';

export class CreateAssetAssignmentDto {
  @IsUUID()
  assetId!: string;

  @IsEnum(AssignmentRecipientType)
  recipientType!: AssignmentRecipientType;

  @ValidateIf(
    (value: CreateAssetAssignmentDto) => value.recipientType === 'EMPLOYEE',
  )
  @IsUUID()
  employeeId?: string;

  @ValidateIf(
    (value: CreateAssetAssignmentDto) => value.recipientType !== 'EMPLOYEE',
  )
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  recipientLabel?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  expectedReturnDate?: string;

  @IsEnum(AssetCondition)
  conditionAtIssue!: AssetCondition;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(1000)
  accessoriesAtIssue?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  purpose!: string;
}

export class ReturnAssetAssignmentDto {
  @IsEnum(AssetCondition)
  conditionAtReturn!: AssetCondition;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(1000)
  accessoriesReturned?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(1000)
  missingItems?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(1000)
  followUp?: string;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  inspectionRequired!: boolean;
}

export class ListAssetAssignmentsQueryDto {
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

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeClosed = false;
}
