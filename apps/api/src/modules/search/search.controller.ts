import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { SearchService } from './search.service';
import type { SearchKind } from './search.util';

@ApiTags('search')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Global search across your designs and the template gallery.' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'kinds', required: false, description: 'Comma-separated: project,template' })
  run(
    @CurrentUser() user: AuthenticatedUser,
    @Query('q') q = '',
    @Query('kinds') kinds?: string,
  ) {
    const parsed = kinds
      ? (kinds.split(',').map((k) => k.trim()).filter(Boolean) as SearchKind[])
      : undefined;
    return this.search.search(user.id, q, parsed);
  }
}
