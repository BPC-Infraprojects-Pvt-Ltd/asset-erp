import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { CurrentActor } from '../auth/current-actor.decorator.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { CreateAssetCategoryDto } from './dto/create-asset-category.dto.js';
import { CreateAssetDto } from './dto/create-asset.dto.js';
import { ListAssetCategoriesQueryDto } from './dto/list-asset-categories-query.dto.js';
import { ListAssetsQueryDto } from './dto/list-assets-query.dto.js';
import { AssetsService } from './assets.service.js';

@Controller('assets')
@UseGuards(AccessTokenGuard)
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get('categories')
  listCategories(
    @CurrentActor() actor: AuthenticatedActor,
    @Query() query: ListAssetCategoriesQueryDto,
  ) {
    return this.assets.listCategories(actor, query);
  }

  @Post('categories')
  @HttpCode(HttpStatus.CREATED)
  createCategory(
    @CurrentActor() actor: AuthenticatedActor,
    @Body() dto: CreateAssetCategoryDto,
  ) {
    return this.assets.createCategory(actor, dto);
  }

  @Get()
  list(
    @CurrentActor() actor: AuthenticatedActor,
    @Query() query: ListAssetsQueryDto,
  ) {
    return this.assets.list(actor, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentActor() actor: AuthenticatedActor,
    @Body() dto: CreateAssetDto,
  ) {
    return this.assets.create(actor, dto);
  }

  @Get(':assetId')
  get(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('assetId', new ParseUUIDPipe()) assetId: string,
  ) {
    return this.assets.get(actor, assetId);
  }
}
