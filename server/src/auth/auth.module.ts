import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AccessTokenGuard } from './access-token.guard.js';
import { AdministratorGuard } from './administrator.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import {
  LocationsController,
  StoresController,
} from '../locations/locations.controller.js';
import { LocationsService } from '../locations/locations.service.js';
import { UsersController } from '../users/users.controller.js';
import { UsersService } from '../users/users.service.js';

@Module({
  imports: [JwtModule.register({})],
  controllers: [
    AuthController,
    UsersController,
    LocationsController,
    StoresController,
  ],
  providers: [
    AuthService,
    AccessTokenGuard,
    AdministratorGuard,
    UsersService,
    LocationsService,
  ],
  exports: [JwtModule, AccessTokenGuard, AdministratorGuard, LocationsService],
})
export class AuthModule {}
