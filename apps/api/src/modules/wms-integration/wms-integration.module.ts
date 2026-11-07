import { Module } from '@nestjs/common';
import { WmsIntegrationService } from './wms-integration.service';

@Module({
  providers: [WmsIntegrationService],
  exports: [WmsIntegrationService],
})
export class WmsIntegrationModule {}

