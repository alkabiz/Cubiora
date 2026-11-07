import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { PublicDisplayModule } from '../public-display/public-display.module';
import { CubiclesModule } from '../cubicles/cubicles.module';
import { OperationalTelemetryModule } from '../operational-telemetry/operational-telemetry.module';
import { WmsIntegrationModule } from '../wms-integration/wms-integration.module';

@Module({
  imports: [
    PublicDisplayModule,
    CubiclesModule,
    OperationalTelemetryModule,
    WmsIntegrationModule,
  ],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
