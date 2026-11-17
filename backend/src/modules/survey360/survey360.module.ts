import { Module } from '@nestjs/common';
import { Survey360Controller } from './survey360.controller';
import { Survey360Service } from './survey360.service';

@Module({
  controllers: [Survey360Controller],
  providers: [Survey360Service],
})
export class Survey360Module {}
