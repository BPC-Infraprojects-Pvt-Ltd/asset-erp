import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SoftwareProductsController } from './software.controller.js';
import { SoftwareService } from './software.service.js';

@Module({
  imports: [AuthModule],
  controllers: [SoftwareProductsController],
  providers: [SoftwareService],
})
export class SoftwareModule {}
