import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { CurrentActor } from '../auth/current-actor.decorator.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { CreateSoftwareEditionDto } from './dto/create-software-edition.dto.js';
import { CreateSoftwareProductDto } from './dto/create-software-product.dto.js';
import { ListSoftwareQueryDto } from './dto/list-software-query.dto.js';
import { UpdateSoftwareEditionDto } from './dto/update-software-edition.dto.js';
import { UpdateSoftwareProductDto } from './dto/update-software-product.dto.js';
import { parseSoftwareVersion } from './software-version.js';
import { SoftwareService } from './software.service.js';

@Controller('software/products')
@UseGuards(AccessTokenGuard)
export class SoftwareProductsController {
  constructor(private readonly software: SoftwareService) {}

  @Get()
  list(
    @CurrentActor() actor: AuthenticatedActor,
    @Query() query: ListSoftwareQueryDto,
  ) {
    return this.software.listProducts(actor, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentActor() actor: AuthenticatedActor,
    @Body() dto: CreateSoftwareProductDto,
  ) {
    return this.software.createProduct(actor, dto);
  }

  @Get(':productId')
  get(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('productId', new ParseUUIDPipe()) productId: string,
  ) {
    return this.software.getProduct(actor, productId);
  }

  @Put(':productId')
  update(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: UpdateSoftwareProductDto,
  ) {
    return this.software.updateProduct(
      actor,
      productId,
      parseSoftwareVersion(ifMatch),
      dto,
    );
  }

  @Post(':productId/deactivate')
  @HttpCode(HttpStatus.OK)
  deactivate(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Headers('if-match') ifMatch: string | undefined,
  ) {
    return this.software.setProductActive(
      actor,
      productId,
      parseSoftwareVersion(ifMatch),
      false,
    );
  }

  @Post(':productId/reactivate')
  @HttpCode(HttpStatus.OK)
  reactivate(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Headers('if-match') ifMatch: string | undefined,
  ) {
    return this.software.setProductActive(
      actor,
      productId,
      parseSoftwareVersion(ifMatch),
      true,
    );
  }

  @Get(':productId/editions')
  listEditions(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Query() query: ListSoftwareQueryDto,
  ) {
    return this.software.listEditions(actor, productId, query);
  }

  @Post(':productId/editions')
  @HttpCode(HttpStatus.CREATED)
  createEdition(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Body() dto: CreateSoftwareEditionDto,
  ) {
    return this.software.createEdition(actor, productId, dto);
  }

  @Put(':productId/editions/:editionId')
  updateEdition(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Param('editionId', new ParseUUIDPipe()) editionId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: UpdateSoftwareEditionDto,
  ) {
    return this.software.updateEdition(
      actor,
      productId,
      editionId,
      parseSoftwareVersion(ifMatch),
      dto,
    );
  }

  @Post(':productId/editions/:editionId/deactivate')
  @HttpCode(HttpStatus.OK)
  deactivateEdition(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Param('editionId', new ParseUUIDPipe()) editionId: string,
    @Headers('if-match') ifMatch: string | undefined,
  ) {
    return this.software.setEditionActive(
      actor,
      productId,
      editionId,
      parseSoftwareVersion(ifMatch),
      false,
    );
  }

  @Post(':productId/editions/:editionId/reactivate')
  @HttpCode(HttpStatus.OK)
  reactivateEdition(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Param('editionId', new ParseUUIDPipe()) editionId: string,
    @Headers('if-match') ifMatch: string | undefined,
  ) {
    return this.software.setEditionActive(
      actor,
      productId,
      editionId,
      parseSoftwareVersion(ifMatch),
      true,
    );
  }
}
