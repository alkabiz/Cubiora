import { Module } from '@nestjs/common';
import { OperationalTelemetryGateway } from './operational-telemetry.gateway';
import { OperationalTelemetryService } from './operational-telemetry.service';
import { CubiclesModule } from '../cubicles/cubicles.module';

@Module({
  imports: [CubiclesModule],
  providers: [OperationalTelemetryGateway, OperationalTelemetryService],
  exports: [OperationalTelemetryGateway, OperationalTelemetryService],
})
export class OperationalTelemetryModule {}

