import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import {
  AssetModelsController,
  CostCentersController,
  DepartmentsController,
  EmployeesController,
  ManufacturersController,
} from './master.controller.js';
import { MasterService } from './master.service.js';

@Module({
  imports: [AuthModule],
  controllers: [
    DepartmentsController,
    CostCentersController,
    ManufacturersController,
    AssetModelsController,
    EmployeesController,
  ],
  providers: [MasterService],
})
export class MasterModule {}
