import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface HealthStatus {
  status: 'ok' | 'error';
  timestamp: string;
  uptime?: number;
  database?: 'connected' | 'disconnected';
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  getLiveness(): HealthStatus {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness(): Promise<{ isHealthy: boolean; status: HealthStatus }> {
    const isDbHealthy = await this.prisma.checkHealth();
    const status: HealthStatus = {
      status: isDbHealthy ? 'ok' : 'error',
      database: isDbHealthy ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    };

    return {
      isHealthy: isDbHealthy,
      status,
    };
  }
}
