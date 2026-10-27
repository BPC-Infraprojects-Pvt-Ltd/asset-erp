import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { AdministratorGuard } from '../auth/administrator.guard.js';
import { CurrentActor } from '../auth/current-actor.decorator.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto.js';
import { SetUserLocationScopeDto } from './dto/set-user-location-scope.dto.js';
import { UpdateUserRoleDto } from './dto/update-user-role.dto.js';
import { UsersService } from './users.service.js';

@Controller('users')
@UseGuards(AccessTokenGuard, AdministratorGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@CurrentActor() actor: AuthenticatedActor) {
    return this.users.list(actor);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentActor() actor: AuthenticatedActor,
    @Body() dto: CreateUserDto,
  ) {
    return this.users.create(actor, dto);
  }

  @Patch(':userId/role')
  changeRole(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.users.changeRole(actor, userId, dto.role);
  }

  @Put(':userId/location-scope')
  setLocationScope(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: SetUserLocationScopeDto,
  ) {
    return this.users.setLocationScope(actor, userId, dto.locationIds);
  }

  @Post(':userId/reset-password')
  resetPassword(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: ResetUserPasswordDto,
  ) {
    return this.users.resetPassword(actor, userId, dto.temporaryPassword);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deactivate(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<void> {
    return this.users.deactivate(actor, userId);
  }
}
