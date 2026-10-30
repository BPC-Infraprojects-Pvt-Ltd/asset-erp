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
import { CreateAssetCategoryDto } from './dto/create-asset-category.dto.js';
import { CreateAssetDto } from './dto/create-asset.dto.js';
import { CommissionAssetDto } from './dto/commission-asset.dto.js';
import { AddAssetRelationshipDto } from './dto/add-asset-relationship.dto.js';
import {
  CreateAssetReservationDto,
  ListAssetReservationsQueryDto,
} from './dto/create-asset-reservation.dto.js';
import {
  CreateAssetAssignmentDto,
  ListAssetAssignmentsQueryDto,
  ReturnAssetAssignmentDto,
} from './dto/create-asset-assignment.dto.js';
import {
  CreateAssetTransferDto,
  ReceiveAssetTransferLineDto,
} from './dto/create-asset-transfer.dto.js';
import {
  InstallAssetComponentDto,
  RemoveAssetComponentDto,
} from './dto/install-asset-component.dto.js';
import { ListAssetCategoriesQueryDto } from './dto/list-asset-categories-query.dto.js';
import { ListAssetsQueryDto } from './dto/list-assets-query.dto.js';
import { AssetsService } from './assets.service.js';
import { UpdateAssetProfileDto } from './dto/update-asset-profile.dto.js';
import { parseAssetVersion } from './asset-version.js';
import { parseAssetCategoryVersion } from './asset-version.js';
import { UpdateAssetCategoryDto } from './dto/update-asset-category.dto.js';

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

  @Get('categories/:categoryId')
  getCategory(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('categoryId', new ParseUUIDPipe()) categoryId: string,
  ) {
    return this.assets.getCategory(actor, categoryId);
  }

  @Put('categories/:categoryId')
  updateCategory(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('categoryId', new ParseUUIDPipe()) categoryId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: UpdateAssetCategoryDto,
  ) {
    return this.assets.updateCategory(
      actor,
      categoryId,
      parseAssetCategoryVersion(ifMatch),
      dto,
    );
  }

  @Post('categories/:categoryId/deactivate')
  @HttpCode(HttpStatus.OK)
  deactivateCategory(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('categoryId', new ParseUUIDPipe()) categoryId: string,
  ) {
    return this.assets.setCategoryActive(actor, categoryId, false);
  }

  @Post('categories/:categoryId/reactivate')
  @HttpCode(HttpStatus.OK)
  reactivateCategory(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('categoryId', new ParseUUIDPipe()) categoryId: string,
  ) {
    return this.assets.setCategoryActive(actor, categoryId, true);
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

  @Post(':assetId/commission')
  @HttpCode(HttpStatus.OK)
  commission(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('assetId', new ParseUUIDPipe()) assetId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: CommissionAssetDto,
  ) {
    return this.assets.commission(
      actor,
      assetId,
      parseAssetVersion(ifMatch),
      dto.commissioningDate,
    );
  }

  @Get(':assetId/relationships')
  relationships(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('assetId', new ParseUUIDPipe()) assetId: string,
  ) {
    return this.assets.relationships(actor, assetId);
  }

  @Post(':assetId/relationships')
  @HttpCode(HttpStatus.CREATED)
  addRelationship(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('assetId', new ParseUUIDPipe()) assetId: string,
    @Body() dto: AddAssetRelationshipDto,
  ) {
    return this.assets.addRelationship(actor, assetId, dto.childAssetId);
  }

  @Post(':assetId/relationships/:relationshipId/end')
  @HttpCode(HttpStatus.OK)
  endRelationship(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('assetId', new ParseUUIDPipe()) assetId: string,
    @Param('relationshipId', new ParseUUIDPipe()) relationshipId: string,
  ) {
    return this.assets.endRelationship(actor, assetId, relationshipId);
  }

  @Get(':assetId/components')
  componentInstallations(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('assetId', new ParseUUIDPipe()) assetId: string,
  ) {
    return this.assets.componentInstallations(actor, assetId);
  }

  @Post(':assetId/components/install')
  @HttpCode(HttpStatus.CREATED)
  installComponent(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('assetId', new ParseUUIDPipe()) assetId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: InstallAssetComponentDto,
  ) {
    return this.assets.installComponent(actor, assetId, idempotencyKey, dto);
  }

  @Post(':assetId/components/:installationId/remove')
  @HttpCode(HttpStatus.OK)
  removeComponent(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('assetId', new ParseUUIDPipe()) assetId: string,
    @Param('installationId', new ParseUUIDPipe()) installationId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: RemoveAssetComponentDto,
  ) {
    return this.assets.removeComponent(
      actor,
      assetId,
      installationId,
      parseAssetVersion(ifMatch),
      idempotencyKey,
      dto,
    );
  }

  @Get(':assetId/history')
  history(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('assetId', new ParseUUIDPipe()) assetId: string,
  ) {
    return this.assets.history(actor, assetId);
  }

  @Get(':assetId')
  get(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('assetId', new ParseUUIDPipe()) assetId: string,
  ) {
    return this.assets.get(actor, assetId);
  }

  @Put(':assetId/profile')
  updateProfile(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('assetId', new ParseUUIDPipe()) assetId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: UpdateAssetProfileDto,
  ) {
    return this.assets.updateProfile(
      actor,
      assetId,
      parseAssetVersion(ifMatch),
      dto,
    );
  }
}

@Controller('reservations')
@UseGuards(AccessTokenGuard)
export class ReservationsController {
  constructor(private readonly assets: AssetsService) {}

  @Get()
  list(
    @CurrentActor() actor: AuthenticatedActor,
    @Query() query: ListAssetReservationsQueryDto,
  ) {
    return this.assets.listReservations(actor, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentActor() actor: AuthenticatedActor,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreateAssetReservationDto,
  ) {
    return this.assets.createReservation(actor, idempotencyKey, dto);
  }

  @Post(':reservationId/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('reservationId', new ParseUUIDPipe()) reservationId: string,
    @Headers('if-match') ifMatch: string | undefined,
  ) {
    return this.assets.cancelReservation(
      actor,
      reservationId,
      parseAssetVersion(ifMatch),
    );
  }
}

@Controller('assignments')
@UseGuards(AccessTokenGuard)
export class AssignmentsController {
  constructor(private readonly assets: AssetsService) {}

  @Get()
  list(
    @CurrentActor() actor: AuthenticatedActor,
    @Query() query: ListAssetAssignmentsQueryDto,
  ) {
    return this.assets.listAssignments(actor, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentActor() actor: AuthenticatedActor,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreateAssetAssignmentDto,
  ) {
    return this.assets.createAssignment(actor, idempotencyKey, dto);
  }

  @Post(':assignmentId/return')
  @HttpCode(HttpStatus.OK)
  returnAsset(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('assignmentId', new ParseUUIDPipe()) assignmentId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: ReturnAssetAssignmentDto,
  ) {
    return this.assets.returnAssignment(
      actor,
      assignmentId,
      parseAssetVersion(ifMatch),
      idempotencyKey,
      dto,
    );
  }
}

@Controller('transfers')
@UseGuards(AccessTokenGuard)
export class TransfersController {
  constructor(private readonly assets: AssetsService) {}

  @Get()
  list(
    @CurrentActor() actor: AuthenticatedActor,
    @Query() query: ListAssetReservationsQueryDto,
  ) {
    return this.assets.listTransfers(actor, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentActor() actor: AuthenticatedActor,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreateAssetTransferDto,
  ) {
    return this.assets.createTransfer(actor, idempotencyKey, dto);
  }

  @Post(':transferId/dispatch')
  @HttpCode(HttpStatus.OK)
  dispatch(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('transferId', new ParseUUIDPipe()) transferId: string,
    @Headers('if-match') ifMatch: string | undefined,
  ) {
    return this.assets.dispatchTransfer(
      actor,
      transferId,
      parseAssetVersion(ifMatch),
    );
  }

  @Post(':transferId/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('transferId', new ParseUUIDPipe()) transferId: string,
    @Headers('if-match') ifMatch: string | undefined,
  ) {
    return this.assets.cancelTransfer(
      actor,
      transferId,
      parseAssetVersion(ifMatch),
    );
  }

  @Post(':transferId/lines/:lineId/receive')
  @HttpCode(HttpStatus.OK)
  receiveLine(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('transferId', new ParseUUIDPipe()) transferId: string,
    @Param('lineId', new ParseUUIDPipe()) lineId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: ReceiveAssetTransferLineDto,
  ) {
    return this.assets.receiveTransferLine(
      actor,
      transferId,
      lineId,
      parseAssetVersion(ifMatch),
      idempotencyKey,
      dto,
    );
  }
}
