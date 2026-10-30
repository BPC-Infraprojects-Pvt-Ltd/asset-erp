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
  Query,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { CurrentActor } from '../auth/current-actor.decorator.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { parseAssetVersion } from '../assets/asset-version.js';
import { CreateVerificationCampaignDto } from './dto/create-verification-campaign.dto.js';
import { CreateVerificationObservationDto } from './dto/create-verification-observation.dto.js';
import { ListVerificationQueryDto } from './dto/list-verification-query.dto.js';
import { ReconcileVerificationObservationDto } from './dto/reconcile-verification-observation.dto.js';
import { VerificationService } from './verification.service.js';

@Controller('verification/campaigns')
@UseGuards(AccessTokenGuard)
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  @Get()
  list(
    @CurrentActor() actor: AuthenticatedActor,
    @Query() query: ListVerificationQueryDto,
  ) {
    return this.verification.listCampaigns(actor, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentActor() actor: AuthenticatedActor,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreateVerificationCampaignDto,
  ) {
    return this.verification.createCampaign(actor, idempotencyKey, dto);
  }

  @Get(':campaignId')
  get(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('campaignId', new ParseUUIDPipe()) campaignId: string,
  ) {
    return this.verification.getCampaign(actor, campaignId);
  }

  @Get(':campaignId/assets')
  listAssets(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('campaignId', new ParseUUIDPipe()) campaignId: string,
    @Query() query: ListVerificationQueryDto,
  ) {
    return this.verification.listExpectedAssets(actor, campaignId, query);
  }

  @Get(':campaignId/observations')
  listObservations(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('campaignId', new ParseUUIDPipe()) campaignId: string,
    @Query() query: ListVerificationQueryDto,
  ) {
    return this.verification.listObservations(actor, campaignId, query);
  }

  @Post(':campaignId/assets/:expectedAssetId/observations')
  @HttpCode(HttpStatus.CREATED)
  observeExpectedAsset(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('campaignId', new ParseUUIDPipe()) campaignId: string,
    @Param('expectedAssetId', new ParseUUIDPipe()) expectedAssetId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreateVerificationObservationDto,
  ) {
    return this.verification.recordObservation(
      actor,
      campaignId,
      expectedAssetId,
      idempotencyKey,
      dto,
    );
  }

  @Post(':campaignId/unexpected-observations')
  @HttpCode(HttpStatus.CREATED)
  observeUnexpectedAsset(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('campaignId', new ParseUUIDPipe()) campaignId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreateVerificationObservationDto,
  ) {
    return this.verification.recordObservation(
      actor,
      campaignId,
      undefined,
      idempotencyKey,
      dto,
    );
  }

  @Post(':campaignId/observations/:observationId/reconcile')
  @HttpCode(HttpStatus.OK)
  reconcileObservation(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('campaignId', new ParseUUIDPipe()) campaignId: string,
    @Param('observationId', new ParseUUIDPipe()) observationId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: ReconcileVerificationObservationDto,
  ) {
    return this.verification.reconcileObservation(
      actor,
      campaignId,
      observationId,
      parseAssetVersion(ifMatch),
      idempotencyKey,
      dto,
    );
  }

  @Post(':campaignId/complete')
  @HttpCode(HttpStatus.OK)
  complete(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('campaignId', new ParseUUIDPipe()) campaignId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.verification.completeCampaign(
      actor,
      campaignId,
      parseAssetVersion(ifMatch),
      idempotencyKey,
    );
  }
}
