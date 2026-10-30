import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  IsArray,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { AssetTrackingMode } from '../../generated/prisma/enums.js';
import { Type } from 'class-transformer';
import { AssetCategorySpecificationFieldDto } from './asset-category-specification-field.dto.js';

export class CreateAssetCategoryDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  code!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsEnum(AssetTrackingMode)
  trackingMode?: AssetTrackingMode;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AssetCategorySpecificationFieldDto)
  specificationFields?: AssetCategorySpecificationFieldDto[];
}
