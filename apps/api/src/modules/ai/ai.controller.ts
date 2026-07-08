import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiService } from './ai.service';
import {
  FontRecoDto,
  GenerateImageDto,
  PaletteDto,
  RewriteDto,
  SceneDto,
  TranslateDto,
  WriteCopyDto,
} from './dto/ai.dto';

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('status')
  @ApiOperation({ summary: 'Report which AI engine is active (anthropic|local).' })
  status() {
    return { engine: this.ai.engine };
  }

  @Post('text/write')
  @ApiOperation({ summary: 'Generate marketing copy from a prompt.' })
  async write(@Body() dto: WriteCopyDto) {
    return { text: await this.ai.writeCopy(dto.prompt, dto.tone), engine: this.ai.engine };
  }

  @Post('text/rewrite')
  @ApiOperation({ summary: 'Rewrite text (shorten/expand/formal/friendly/fix).' })
  async rewrite(@Body() dto: RewriteDto) {
    return { text: await this.ai.rewrite(dto.text, dto.mode), engine: this.ai.engine };
  }

  @Post('text/translate')
  @ApiOperation({ summary: 'Translate text to a target language.' })
  async translate(@Body() dto: TranslateDto) {
    return { text: await this.ai.translate(dto.text, dto.target), engine: this.ai.engine };
  }

  @Post('color-palette')
  @ApiOperation({ summary: 'Generate a colour palette from a prompt.' })
  palette(@Body() dto: PaletteDto) {
    return this.ai.colorPalette(dto.prompt, dto.harmony);
  }

  @Post('font-recommendation')
  @ApiOperation({ summary: 'Recommend font pairings for a keyword/use-case.' })
  fonts(@Body() dto: FontRecoDto) {
    return { pairings: this.ai.fontRecommendations(dto.keyword) };
  }

  @Post('design-suggestions')
  @ApiOperation({ summary: 'Heuristic design critique of a scene.' })
  suggestions(@Body() dto: SceneDto) {
    return { suggestions: this.ai.designSuggestions(dto.scene) };
  }

  @Post('accessibility-check')
  @ApiOperation({ summary: 'WCAG contrast + readability audit of a scene.' })
  accessibility(@Body() dto: SceneDto) {
    return this.ai.accessibility(dto.scene);
  }

  @Post('image/generate')
  @ApiOperation({ summary: 'Generate an image from a text prompt.' })
  image(@Body() dto: GenerateImageDto) {
    return this.ai.generateImage(dto.prompt, dto.width, dto.height);
  }
}
