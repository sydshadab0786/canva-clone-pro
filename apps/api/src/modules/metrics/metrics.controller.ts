import { Controller, Get, Header, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Public()
  @Get()
  @ApiExcludeEndpoint()
  @Header('Cache-Control', 'no-store')
  async scrape(@Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', this.metrics.contentType());
    res.send(await this.metrics.metrics());
  }
}
