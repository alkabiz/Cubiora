import { Module } from '@nestjs/common';
import { OperationalTelemetryModule } from '../operational-telemetry/operational-telemetry.module';
import { FacilitiesController } from './facilities.controller';
import { FacilitiesService } from './facilities.service';

@Module({
  imports: [OperationalTelemetryModule],
  controllers: [FacilitiesController],
  providers: [FacilitiesService],
  exports: [FacilitiesService],
})
export class FacilitiesModule {}

