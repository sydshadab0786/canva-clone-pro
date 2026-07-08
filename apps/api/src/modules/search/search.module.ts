import { Global, Module } from '@nestjs/common';
import { ElasticsearchService } from './elasticsearch.service';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

/**
 * Global so other modules (projects/templates/media) can inject
 * ElasticsearchService to keep the index in sync on writes.
 */
@Global()
@Module({
  controllers: [SearchController],
  providers: [ElasticsearchService, SearchService],
  exports: [ElasticsearchService, SearchService],
})
export class SearchModule {}
