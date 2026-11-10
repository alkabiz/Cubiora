import { Module } from '@nestjs/common';
import { OperationalTelemetryModule } from '../operational-telemetry/operational-telemetry.module';
import { PharmacistsController } from './pharmacists.controller';
import { PharmacistsService } from './pharmacists.service';

@Module({
  imports: [OperationalTelemetryModule],
  controllers: [PharmacistsController],
  providers: [PharmacistsService],
  exports: [PharmacistsService],
})
export class PharmacistsModule {}

