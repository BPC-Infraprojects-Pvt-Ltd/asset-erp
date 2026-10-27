import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class SetUserLocationScopeDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  locationIds!: string[];
}
