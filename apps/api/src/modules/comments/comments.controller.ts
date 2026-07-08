import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/comments.dto';

@ApiTags('comments')
@ApiBearerAuth()
@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get('projects/:projectId/comments')
  @ApiOperation({ summary: 'List comments on a project.' })
  list(@CurrentUser() user: AuthenticatedUser, @Param('projectId') projectId: string) {
    return this.comments.list(user.id, projectId);
  }

  @Post('projects/:projectId/comments')
  @ApiOperation({ summary: 'Add a comment (parses @mentions into notifications).' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.create(user.id, projectId, dto);
  }

  @Patch('comments/:id/resolve')
  @ApiOperation({ summary: 'Mark a comment resolved.' })
  resolve(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.comments.resolve(user.id, id, true);
  }

  @Patch('comments/:id/reopen')
  @ApiOperation({ summary: 'Reopen a resolved comment.' })
  reopen(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.comments.resolve(user.id, id, false);
  }

  @Delete('comments/:id')
  @ApiOperation({ summary: 'Delete a comment (author or project owner).' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.comments.remove(user.id, id);
  }
}
