import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseFilePipeBuilder,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { MediaService, UploadedFile as UploadedFileType } from './media.service';
import {
  ConfirmUploadDto,
  ListAssetsQueryDto,
  PresignDto,
  UpdateAssetDto,
  UploadMetaDto,
} from './dto/media.dto';
import { MAX_UPLOAD_BYTES } from './media.util';

@ApiTags('media')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a file (multipart) and create an asset.' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile(
      new ParseFilePipeBuilder().build({ fileIsRequired: true }),
    )
    file: UploadedFileType,
    @Body() meta: UploadMetaDto,
  ) {
    return this.media.upload(user.id, file, meta);
  }

  @Post('presign')
  @ApiOperation({ summary: 'Get a presigned URL for direct browser upload.' })
  presign(@CurrentUser() user: AuthenticatedUser, @Body() dto: PresignDto) {
    return this.media.presign(user.id, dto);
  }

  @Post('confirm')
  @ApiOperation({ summary: 'Confirm an asset after a presigned upload completes.' })
  confirm(@CurrentUser() user: AuthenticatedUser, @Body() dto: ConfirmUploadDto) {
    return this.media.confirm(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List the current user assets (filters + pagination).' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListAssetsQueryDto) {
    return this.media.list(user.id, query);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename / tag / favorite an asset.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAssetDto,
  ) {
    return this.media.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Move an asset to trash.' })
  trash(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.media.trash(user.id, id);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore an asset from trash.' })
  restore(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.media.restore(user.id, id);
  }

  @Delete(':id/permanent')
  @ApiOperation({ summary: 'Permanently delete an asset (and its storage object).' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.media.remove(user.id, id);
  }
}
