import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HealthService, HealthStatus } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  @HttpCode(HttpStatus.OK)
  getLive(): HealthStatus {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  async getReady(): Promise<HealthStatus> {
    const { isHealthy, status } = await this.healthService.getReadiness();
    if (!isHealthy) {
      throw new ServiceUnavailableException(status);
    }
    return status;
  }
}
