import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { RetirementRequestsController } from './retirement-requests.controller.js';
import { RetirementRequestsService } from './retirement-requests.service.js';

@Module({
  imports: [AuthModule, AssetsModule],
  controllers: [RetirementRequestsController],
  providers: [RetirementRequestsService],
})
export class RetirementsModule {}
