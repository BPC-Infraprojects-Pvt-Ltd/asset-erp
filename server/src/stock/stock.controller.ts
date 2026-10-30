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
import { CreateStockItemDto } from './dto/create-stock-item.dto.js';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto.js';
import { CreateStockReservationDto } from './dto/create-stock-reservation.dto.js';
import {
  ListStockItemsQueryDto,
  ListStockMovementsQueryDto,
  ListStockReservationsQueryDto,
} from './dto/stock-queries.dto.js';
import { StockService } from './stock.service.js';

@Controller('stock')
@UseGuards(AccessTokenGuard)
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get('items')
  listItems(
    @CurrentActor() actor: AuthenticatedActor,
    @Query() query: ListStockItemsQueryDto,
  ) {
    return this.stock.listItems(actor, query);
  }

  @Post('items')
  @HttpCode(HttpStatus.CREATED)
  createItem(
    @CurrentActor() actor: AuthenticatedActor,
    @Body() dto: CreateStockItemDto,
  ) {
    return this.stock.createItem(actor, dto);
  }

  @Get('movements')
  listMovements(
    @CurrentActor() actor: AuthenticatedActor,
    @Query() query: ListStockMovementsQueryDto,
  ) {
    return this.stock.listMovements(actor, query);
  }

  @Post('items/:itemId/movements')
  @HttpCode(HttpStatus.CREATED)
  createMovement(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreateStockMovementDto,
  ) {
    return this.stock.createMovement(actor, itemId, idempotencyKey, dto);
  }

  @Get('reservations')
  listReservations(
    @CurrentActor() actor: AuthenticatedActor,
    @Query() query: ListStockReservationsQueryDto,
  ) {
    return this.stock.listReservations(actor, query);
  }

  @Post('reservations')
  @HttpCode(HttpStatus.CREATED)
  createReservation(
    @CurrentActor() actor: AuthenticatedActor,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreateStockReservationDto,
  ) {
    return this.stock.createReservation(actor, idempotencyKey, dto);
  }

  @Post('reservations/:reservationId/cancel')
  @HttpCode(HttpStatus.OK)
  cancelReservation(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('reservationId', new ParseUUIDPipe()) reservationId: string,
    @Headers('if-match') ifMatch: string | undefined,
  ) {
    return this.stock.cancelReservation(
      actor,
      reservationId,
      parseAssetVersion(ifMatch),
    );
  }
}
