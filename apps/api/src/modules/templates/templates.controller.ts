import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { TemplatesService } from './templates.service';
import { ListTemplatesQueryDto } from './dto/templates.dto';

@ApiTags('templates')
@ApiBearerAuth()
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'Browse the template gallery (filters + pagination).' })
  list(@Query() query: ListTemplatesQueryDto) {
    return this.templates.list(query);
  }

  @Get('categories')
  @ApiOperation({ summary: 'List template categories with counts.' })
  categories() {
    return this.templates.categories();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single template including its document.' })
  get(@Param('id') id: string) {
    return this.templates.getById(id);
  }

  @Post(':id/use')
  @ApiOperation({ summary: 'Create a new design from this template.' })
  use(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.templates.use(user.id, id);
  }
}
