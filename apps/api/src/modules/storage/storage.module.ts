import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';

/** Global: media and (later) export/AI modules all share one storage client. */
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
