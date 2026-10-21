import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from '../src/modules/health/health.controller';
import { HealthService } from '../src/modules/health/health.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Health Module (Inyección de Dependencias + Vitest)', () => {
  let controller: HealthController;
  let prismaService: { checkHealth: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prismaService = {
      checkHealth: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe('GET /health/live', () => {
    it('debe responder status ok y uptime positivo', () => {
      const response = controller.getLive();
      expect(response.status).toBe('ok');
      expect(typeof response.uptime).toBe('number');
      expect(response.uptime).toBeGreaterThanOrEqual(0);
      expect(response.timestamp).toBeDefined();
    });
  });

  describe('GET /health/ready', () => {
    it('debe responder status ok cuando la base de datos responde', async () => {
      prismaService.checkHealth.mockResolvedValue(true);

      const response = await controller.getReady();
      expect(response.status).toBe('ok');
      expect(response.database).toBe('connected');
      expect(response.timestamp).toBeDefined();
    });

    it('debe lanzar ServiceUnavailableException (503) cuando la base de datos no responde', async () => {
      prismaService.checkHealth.mockResolvedValue(false);

      await expect(controller.getReady()).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
