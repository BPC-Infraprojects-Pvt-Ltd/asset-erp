import { IsUUID } from 'class-validator';

export class AddAssetRelationshipDto {
  @IsUUID()
  childAssetId!: string;
}
