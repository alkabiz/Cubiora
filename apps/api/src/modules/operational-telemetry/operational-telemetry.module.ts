import { Module, forwardRef } from '@nestjs/common';
import { OperationalTelemetryGateway } from './operational-telemetry.gateway';
import { OperationalTelemetryService } from './operational-telemetry.service';
import { CubiclesModule } from '../cubicles/cubicles.module';

@Module({
  imports: [forwardRef(() => CubiclesModule)],
  providers: [OperationalTelemetryGateway, OperationalTelemetryService],
  exports: [OperationalTelemetryGateway, OperationalTelemetryService],
})
export class OperationalTelemetryModule {}

