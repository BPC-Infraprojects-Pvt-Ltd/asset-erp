import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import {
  AssetsController,
  AssignmentsController,
  ReservationsController,
  TransfersController,
} from './assets.controller.js';
import { AssetImportsController } from './asset-imports.controller.js';
import { AssetImportsService } from './asset-imports.service.js';
import { AssetsService } from './assets.service.js';

@Module({
  imports: [AuthModule],
  controllers: [
    AssetsController,
    ReservationsController,
    AssignmentsController,
    TransfersController,
    AssetImportsController,
  ],
  providers: [AssetsService, AssetImportsService],
  exports: [AssetsService],
})
export class AssetsModule {}
