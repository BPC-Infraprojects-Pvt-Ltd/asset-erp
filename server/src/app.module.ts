import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { validateEnvironment } from './config/environment.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AssetsModule } from './assets/assets.module.js';
import { MasterModule } from './master/master.module.js';
import { SoftwareModule } from './software/software.module.js';
import { StockModule } from './stock/stock.module.js';
import { VerificationModule } from './verification/verification.module.js';
import { RetirementsModule } from './retirements/retirements.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    PrismaModule,
    AuthModule,
    AssetsModule,
    MasterModule,
    SoftwareModule,
    StockModule,
    VerificationModule,
    RetirementsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
