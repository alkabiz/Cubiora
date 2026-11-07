import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { UserRole } from '@cubiora/shared';
import { CubiclesController } from '../src/modules/cubicles/cubicles.controller';
import { CubiclesService } from '../src/modules/cubicles/cubicles.service';
import { UpdateCubicleOperatorDto } from '../src/modules/cubicles/dto/update-cubicle-operator.dto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMockService(overrides: Partial<CubiclesService> = {}): CubiclesService {
  return {
    updateOperator: vi.fn(),
    getDailyPerformance: vi.fn(),
    getCubicleSnapshotByCode: vi.fn(),
    getOrCreateCubicleByCode: vi.fn(),
    buildCubicleSnapshot: vi.fn(),
    ...overrides,
  } as unknown as CubiclesService;
}

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpdateCubicleOperatorDto, plain);
  return validate(dto);
}

// ---------------------------------------------------------------------------
// Tests: UpdateCubicleOperatorDto
// ---------------------------------------------------------------------------

describe('UpdateCubicleOperatorDto – validación', () => {
  it('acepta un nombre válido con letras y espacios', async () => {
    const errors = await validateDto({ operatorName: 'María López' });
    expect(errors).toHaveLength(0);
  });

  it('acepta nombres con puntos y guiones', async () => {
    const errors = await validateDto({ operatorName: 'J. Smith-Doe' });
    expect(errors).toHaveLength(0);
  });

  it('acepta cadena vacía para borrar el operador', async () => {
    const errors = await validateDto({ operatorName: '' });
    expect(errors).toHaveLength(0);
  });

  it('aplica trim automáticamente al valor recibido', () => {
    const dto = plainToInstance(UpdateCubicleOperatorDto, {
      operatorName: '  Juan Pérez  ',
    });
    expect(dto.operatorName).toBe('Juan Pérez');
  });

  it('rechaza nombres con caracteres prohibidos (<script>)', async () => {
    const errors = await validateDto({ operatorName: '<script>alert(1)</script>' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rechaza nombres con números', async () => {
    const errors = await validateDto({ operatorName: 'Juan123' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rechaza nombres que superan 120 caracteres', async () => {
    const errors = await validateDto({ operatorName: 'A'.repeat(121) });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('acepta exactamente 120 caracteres', async () => {
    const errors = await validateDto({ operatorName: 'A'.repeat(120) });
    expect(errors).toHaveLength(0);
  });

  it('rechaza valores no-string', async () => {
    const errors = await validateDto({ operatorName: 42 as unknown as string });
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: CubiclesService.updateOperator
// ---------------------------------------------------------------------------

describe('CubiclesService.updateOperator', () => {
  let prisma: {
    cubicle: {
      findUnique: ReturnType<typeof vi.fn>;
    };
  };
  let service: CubiclesService;

  beforeEach(() => {
    prisma = {
      cubicle: {
        findUnique: vi.fn(),
      },
    };
    service = new CubiclesService(prisma as never);
  });

  it('lanza NotFoundException si el cubículo no existe', async () => {
    prisma.cubicle.findUnique.mockResolvedValue(null);

    await expect(
      service.updateOperator('id-inexistente', 'Juan'),
    ).rejects.toThrow(NotFoundException);
  });

  it('retorna { id, operatorName } con el nombre recibido cuando el cubículo existe', async () => {
    prisma.cubicle.findUnique.mockResolvedValue({ id: 'cub-01' });

    const result = await service.updateOperator('cub-01', 'María López');

    expect(result).toEqual({ id: 'cub-01', operatorName: 'María López' });
  });

  it('retorna operatorName null cuando se recibe cadena vacía (borrar operador)', async () => {
    prisma.cubicle.findUnique.mockResolvedValue({ id: 'cub-01' });

    const result = await service.updateOperator('cub-01', '');

    expect(result).toEqual({ id: 'cub-01', operatorName: null });
  });

  it('llama a prisma.cubicle.findUnique con el id correcto', async () => {
    prisma.cubicle.findUnique.mockResolvedValue({ id: 'cub-02' });

    await service.updateOperator('cub-02', 'Operador Test');

    expect(prisma.cubicle.findUnique).toHaveBeenCalledWith({
      where: { id: 'cub-02' },
      select: { id: true },
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: CubiclesController.updateOperator
// ---------------------------------------------------------------------------

describe('CubiclesController.updateOperator', () => {
  let mockService: CubiclesService;
  let controller: CubiclesController;

  beforeEach(() => {
    mockService = buildMockService();
    controller = new CubiclesController(mockService);
  });

  it('retorna { success: true, data: { id, operatorName } } en caso exitoso', async () => {
    vi.mocked(mockService.updateOperator).mockResolvedValue({
      id: 'cub-01',
      operatorName: 'María López',
    });

    const dto = plainToInstance(UpdateCubicleOperatorDto, {
      operatorName: 'María López',
    });

    const response = await controller.updateOperator('cub-01', dto);

    expect(response).toEqual({
      success: true,
      data: { id: 'cub-01', operatorName: 'María López' },
    });
  });

  it('retorna operatorName null cuando se borra el operador', async () => {
    vi.mocked(mockService.updateOperator).mockResolvedValue({
      id: 'cub-01',
      operatorName: null,
    });

    const dto = plainToInstance(UpdateCubicleOperatorDto, { operatorName: '' });
    const response = await controller.updateOperator('cub-01', dto);

    expect(response.success).toBe(true);
    expect(response.data.operatorName).toBeNull();
  });

  it('propaga NotFoundException cuando el servicio la lanza', async () => {
    vi.mocked(mockService.updateOperator).mockRejectedValue(
      new NotFoundException('No encontrado'),
    );

    const dto = plainToInstance(UpdateCubicleOperatorDto, {
      operatorName: 'Juan',
    });

    await expect(controller.updateOperator('id-no-existe', dto)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('el endpoint tiene @Roles(ADMIN, CASHIER) en sus metadatos', () => {
    // Verifica que los roles esperados estén declarados en el método
    const roles: UserRole[] = Reflect.getMetadata(
      'roles',
      CubiclesController.prototype.updateOperator,
    );
    expect(roles).toContain(UserRole.ADMIN);
    expect(roles).toContain(UserRole.CASHIER);
  });
});
