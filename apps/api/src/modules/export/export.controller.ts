import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ExportService } from './export.service';

class StartExportDto {
  @IsOptional()
  @IsIn(['mp4', 'webm', 'gif'])
  format?: string;
}

@ApiTags('export')
@ApiBearerAuth()
@Controller()
export class ExportController {
  constructor(private readonly exports: ExportService) {}

  @Post('projects/:id/export')
  @ApiOperation({ summary: 'Start rendering a project timeline to a video file.' })
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: StartExportDto,
  ) {
    return this.exports.start(user.id, id, dto.format ?? 'mp4');
  }

  @Get('export/:jobId')
  @ApiOperation({ summary: 'Poll an export job status.' })
  status(@CurrentUser() user: AuthenticatedUser, @Param('jobId') jobId: string) {
    return this.exports.get(user.id, jobId);
  }
}
