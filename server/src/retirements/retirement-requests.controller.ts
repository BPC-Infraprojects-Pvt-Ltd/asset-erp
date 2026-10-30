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
import { CreateRetirementRequestDto } from './dto/create-retirement-request.dto.js';
import { ListRetirementRequestsQueryDto } from './dto/list-retirement-requests-query.dto.js';
import { RetirementRequestsService } from './retirement-requests.service.js';

@Controller('retirements')
@UseGuards(AccessTokenGuard)
export class RetirementRequestsController {
  constructor(private readonly requests: RetirementRequestsService) {}

  @Get('requests')
  list(
    @CurrentActor() actor: AuthenticatedActor,
    @Query() query: ListRetirementRequestsQueryDto,
  ) {
    return this.requests.list(actor, query);
  }

  @Post('assets/:assetId/requests')
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('assetId', new ParseUUIDPipe()) assetId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreateRetirementRequestDto,
  ) {
    return this.requests.create(actor, assetId, idempotencyKey, dto);
  }
}
