import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { CouponsService } from './coupons.service';

@Module({
  controllers: [BillingController],
  providers: [BillingService, CouponsService],
  exports: [BillingService],
})
export class BillingModule {}
