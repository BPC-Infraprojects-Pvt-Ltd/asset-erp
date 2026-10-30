import { IsOptional, IsUUID } from 'class-validator';
import { ListMasterRecordsQueryDto } from './list-master-records-query.dto.js';

export class ListAssetModelsQueryDto extends ListMasterRecordsQueryDto {
  @IsOptional()
  @IsUUID()
  manufacturerId?: string;
}
