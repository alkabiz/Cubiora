import { Module, forwardRef } from '@nestjs/common';
import { CubiclesController } from './cubicles.controller';
import { AdminCubiclesController } from './admin-cubicles.controller';
import { CubiclesService } from './cubicles.service';
import { OperationalTelemetryModule } from '../operational-telemetry/operational-telemetry.module';

@Module({
  imports: [forwardRef(() => OperationalTelemetryModule)],
  controllers: [CubiclesController, AdminCubiclesController],
  providers: [CubiclesService],
  exports: [CubiclesService],
})
export class CubiclesModule {}
