import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OperationalTelemetryModule } from '../operational-telemetry/operational-telemetry.module';

@Module({
  imports: [OperationalTelemetryModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
