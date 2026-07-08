import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AnthropicClient } from './anthropic.client';

@Module({
  controllers: [AiController],
  providers: [AiService, AnthropicClient],
  exports: [AiService],
})
export class AiModule {}
