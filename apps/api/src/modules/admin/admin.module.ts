import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { FeatureFlagsService } from './feature-flags.service';

@Module({
  imports: [AnalyticsModule],
  controllers: [AdminController],
  providers: [AdminService, FeatureFlagsService],
  exports: [FeatureFlagsService],
})
export class AdminModule {}
