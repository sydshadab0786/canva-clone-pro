import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { BillingService } from './billing.service';
import { CheckoutDto, ConsumeCreditsDto } from './dto/billing.dto';

@ApiTags('billing')
@ApiBearerAuth()
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('plans')
  @ApiOperation({ summary: 'List available plans.' })
  plans() {
    return this.billing.listPlans();
  }

  @Get('subscription')
  @ApiOperation({ summary: 'Get the current user subscription (or synthetic Free).' })
  subscription(@CurrentUser() user: AuthenticatedUser) {
    return this.billing.current(user.id);
  }

  @Get('preview')
  @ApiOperation({ summary: 'Preview a checkout price with an optional coupon.' })
  preview(@Query('planCode') planCode: string, @Query('couponCode') couponCode?: string) {
    return this.billing.preview(planCode, couponCode);
  }

  @Post('checkout')
  @ApiOperation({ summary: 'Subscribe to a plan (activates in mock mode).' })
  checkout(@CurrentUser() user: AuthenticatedUser, @Body() dto: CheckoutDto) {
    return this.billing.checkout(user.id, dto.planCode, dto.couponCode);
  }

  @Post('cancel')
  @ApiOperation({ summary: 'Cancel at period end.' })
  cancel(@CurrentUser() user: AuthenticatedUser) {
    return this.billing.cancel(user.id);
  }

  @Post('credits/consume')
  @ApiOperation({ summary: 'Consume AI credits from the subscription balance.' })
  consume(@CurrentUser() user: AuthenticatedUser, @Body() dto: ConsumeCreditsDto) {
    return this.billing.consumeCredits(user.id, dto.amount);
  }

  @Get('invoices')
  @ApiOperation({ summary: 'List invoices for the current user.' })
  invoices(@CurrentUser() user: AuthenticatedUser) {
    return this.billing.invoices(user.id);
  }

  @Public()
  @Post('webhook')
  @ApiOperation({ summary: 'Payment provider webhook sink.' })
  webhook(@Body() event: { type?: string; data?: unknown }) {
    return this.billing.handleWebhook(event);
  }
}
