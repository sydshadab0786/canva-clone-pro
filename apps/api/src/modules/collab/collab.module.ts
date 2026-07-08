import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CollabGateway } from './collab.gateway';

@Module({
  imports: [JwtModule.register({})],
  providers: [CollabGateway],
})
export class CollabModule {}
