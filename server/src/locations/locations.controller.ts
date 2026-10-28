import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { AdministratorGuard } from '../auth/administrator.guard.js';
import { CurrentActor } from '../auth/current-actor.decorator.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { CreateLocationDto } from './dto/create-location.dto.js';
import { CreateStoreDto } from './dto/create-store.dto.js';
import { LocationsService } from './locations.service.js';

@Controller('locations')
@UseGuards(AccessTokenGuard)
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get()
  list(@CurrentActor() actor: AuthenticatedActor) {
    return this.locations.listLocations(actor);
  }

  @Post()
  @UseGuards(AdministratorGuard)
  create(
    @CurrentActor() actor: AuthenticatedActor,
    @Body() dto: CreateLocationDto,
  ) {
    return this.locations.createLocation(actor, dto);
  }
}

@Controller('stores')
@UseGuards(AccessTokenGuard)
export class StoresController {
  constructor(private readonly locations: LocationsService) {}

  @Get()
  list(@CurrentActor() actor: AuthenticatedActor) {
    return this.locations.listStores(actor);
  }

  @Post()
  @UseGuards(AdministratorGuard)
  create(
    @CurrentActor() actor: AuthenticatedActor,
    @Body() dto: CreateStoreDto,
  ) {
    return this.locations.createStore(actor, dto);
  }
}
