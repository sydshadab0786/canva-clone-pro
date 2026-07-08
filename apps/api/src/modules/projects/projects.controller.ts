import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ProjectsService } from './projects.service';
import {
  CreateProjectDto,
  ListProjectsQueryDto,
  SaveDocumentDto,
  UpdateProjectDto,
} from './dto/project.dto';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new design.' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProjectDto) {
    return this.projects.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List the current user designs (filters + pagination).' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListProjectsQueryDto) {
    return this.projects.list(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single design including its full document.' })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.projects.getById(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update design metadata (title, folder, favorite…).' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projects.update(user.id, id, dto);
  }

  @Put(':id/document')
  @ApiOperation({ summary: 'Autosave the scene document (with optional version snapshot).' })
  saveDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SaveDocumentDto,
  ) {
    return this.projects.saveDocument(user.id, id, dto);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'List saved version snapshots.' })
  versions(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.projects.listVersions(user.id, id);
  }

  @Post(':id/versions/:versionId/restore')
  @ApiOperation({ summary: 'Restore the document from a version snapshot.' })
  restoreVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    return this.projects.restoreVersion(user.id, id, versionId);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate a design.' })
  duplicate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.projects.duplicate(user.id, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Move a design to trash (soft delete).' })
  trash(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.projects.trash(user.id, id);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore a design from trash.' })
  restore(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.projects.restore(user.id, id);
  }

  @Delete(':id/permanent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently delete a design.' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.projects.remove(user.id, id);
  }
}
