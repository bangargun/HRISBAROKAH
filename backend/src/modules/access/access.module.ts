import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { AccessController } from './access.controller';
import { AccessMatrixService } from './access-matrix.service';

@Module({
  imports: [DiscoveryModule],
  controllers: [AccessController],
  providers: [AccessMatrixService],
})
export class AccessModule {}
