import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ulid } from 'ulid';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CubicleSnapshot,
  CubicleStatus,
  TicketStatus,
  ApiErrorCode,
} from '@cubiora/shared';

@Injectable()
export class CubiclesService {
  private readonly logger = new Logger(CubiclesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene o asegura la existencia de un cubículo por su código y retorna su snapshot actual.
   * Soporta formatos como 'CUB-03', '03', 'CUB-01', '1', etc.
   */
  async getOrCreateCubicleByCode(codeParam: string): Promise<CubicleSnapshot> {
    const rawCode = codeParam.trim().toUpperCase();
    const normalizedCode = rawCode.startsWith('CUB-')
      ? rawCode
      : `CUB-${rawCode.padStart(2, '0')}`;

    // 1. Buscar cubículo en la base de datos
    let cubicle = await this.prisma.cubicle.findFirst({
      where: {
        OR: [{ code: normalizedCode }, { code: rawCode }],
      },
    });

    // 2. Si no existe, inicializarlo de manera automática y segura
    if (!cubicle) {
      const displayNumber = rawCode.replace(/\D/g, '') || '01';
      const paddedNumber = displayNumber.padStart(2, '0');
      const cubicleId = ulid();

      cubicle = await this.prisma.cubicle.create({
        data: {
          id: cubicleId,
          code: normalizedCode,
          displayName: `Cubículo ${paddedNumber}`,
          status: CubicleStatus.AVAILABLE,
          active: true,
          version: 1,
        },
      });
      this.logger.log(`Cubículo ${cubicle.code} inicializado automáticamente con id ${cubicle.id}`);
    }

    return this.buildCubicleSnapshot(cubicle.id);
  }

  /**
   * Construye el snapshot completo del cubículo buscando el ticket activo si existe.
   */
  async buildCubicleSnapshot(cubicleId: string): Promise<CubicleSnapshot> {
    const cubicle = await this.prisma.cubicle.findUnique({
      where: { id: cubicleId },
    });

    if (!cubicle) {
      throw new NotFoundException({
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        message: `Cubículo no encontrado con id ${cubicleId}`,
      });
    }

    // Buscar ticket activo asociado a este cubículo
    const activeTicketRaw = await this.prisma.ticket.findFirst({
      where: {
        cubicleId: cubicle.id,
        status: {
          in: [TicketStatus.ASSIGNED, TicketStatus.CALLED, TicketStatus.IN_SERVICE],
        },
      },
      include: {
        calls: {
          orderBy: { callNumber: 'desc' },
          take: 1,
        },
      },
    });

    let activeTicket = null;
    if (activeTicketRaw) {
      const lastCall = activeTicketRaw.calls[0];
      activeTicket = {
        id: activeTicketRaw.id,
        publicId: activeTicketRaw.publicId,
        publicCode: activeTicketRaw.publicCode,
        patientName: activeTicketRaw.patientName,
        status: activeTicketRaw.status as TicketStatus,
        version: activeTicketRaw.version,
        assignedAt: activeTicketRaw.assignedAt?.toISOString() ?? null,
        calledAt: activeTicketRaw.calledAt?.toISOString() ?? null,
        serviceStartedAt: activeTicketRaw.serviceStartedAt?.toISOString() ?? null,
        callNumber: lastCall?.callNumber ?? 0,
      };
    }

    return {
      cubicle: {
        id: cubicle.id,
        code: cubicle.code,
        displayName: cubicle.displayName,
        status: cubicle.status as CubicleStatus,
        version: cubicle.version,
      },
      activeTicket,
    };
  }
}
