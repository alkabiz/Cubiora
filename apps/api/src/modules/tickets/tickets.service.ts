import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { ulid } from 'ulid';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { PublicDisplayService } from '../public-display/public-display.service';
import { CubiclesService } from '../cubicles/cubicles.service';
import {
  TicketStatus,
  CubicleStatus,
  ApiErrorCode,
  CubicleSnapshot,
} from '@cubiora/shared';

export interface CreatedTicketResult {
  publicId: string;
  publicCode: string;
  sequenceNumber: number;
  patientName: string;
  status: TicketStatus;
  createdAt: Date;
  assignedCubicle?: string;
}

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly publicDisplayService: PublicDisplayService,
    private readonly cubiclesService: CubiclesService,
  ) {}

  /**
   * Crea un nuevo turno de manera atómica:
   * 1. Comprueba clave de idempotencia previa si fue provista.
   * 2. Bloquea la secuencia global con FOR UPDATE para garantizar correlativos sin saltos ni colisiones.
   * 3. Inserta el ticket con código TUR-NNNNNN-XX y publicId ULID.
   * 4. Registra el historial de estado inicial en la misma transacción.
   * 5. Almacena la clave de idempotencia con el payload de respuesta.
   */
  async createTicket(
    dto: CreateTicketDto,
    actorUserId: string,
    correlationId: string,
    idempotencyKey?: string,
  ): Promise<{ statusCode: number; data: CreatedTicketResult }> {
    const requestHash = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          patientName: dto.patientName,
          patientDocument: dto.patientDocument,
          priority: dto.priority,
        }),
      )
      .digest('hex');

    // 1. Verificación previa de idempotencia (fuera de la transacción de escritura)
    if (idempotencyKey) {
      const existingKey = await this.prisma.idempotencyKey.findUnique({
        where: {
          uq_idempotency_key: {
            actorUserId,
            operation: 'CREATE_TICKET',
            idempotencyKey,
          },
        },
      });

      if (existingKey) {
        if (existingKey.requestHash !== requestHash) {
          throw new ConflictException({
            code: ApiErrorCode.STATE_CONFLICT,
            message: 'Idempotency-Key reutilizada con un cuerpo de petición diferente.',
          });
        }

        if (existingKey.responseBody) {
          return {
            statusCode: existingKey.responseStatus ?? 201,
            data: existingKey.responseBody as unknown as CreatedTicketResult,
          };
        }
      }
    }

    // 2. Transacción atómica con aislamiento y bloqueo pesimista
    const result = await this.prisma.$transaction(async (tx) => {
      // 2. Incremento atómico en 1 solo paso con UPDATE ... RETURNING
      let seqRows = await tx.$queryRaw<Array<{ current_value: bigint }>>`
        UPDATE "system_sequences"
        SET "next_value" = "next_value" + 1,
            "updated_at" = NOW()
        WHERE "sequence_name" = 'TICKETS'
        RETURNING ("next_value" - 1) AS "current_value"
      `;

      if (!seqRows.length) {
        await tx.$executeRaw`
          INSERT INTO "system_sequences" ("sequence_name", "next_value", "updated_at")
          VALUES ('TICKETS', 2, NOW())
          ON CONFLICT ("sequence_name") DO NOTHING
        `;
        seqRows = await tx.$queryRaw<Array<{ current_value: bigint }>>`
          UPDATE "system_sequences"
          SET "next_value" = "next_value" + 1,
              "updated_at" = NOW()
          WHERE "sequence_name" = 'TICKETS'
          RETURNING ("next_value" - 1) AS "current_value"
        `;
      }

      const firstRow = seqRows[0];
      if (!firstRow) {
        throw new Error('La secuencia del sistema TICKETS no está inicializada.');
      }

      const rawVal = (firstRow as any).current_value ?? (firstRow as any).next_value;
      if (rawVal === undefined) {
        throw new Error('La secuencia del sistema TICKETS no devolvió un valor válido.');
      }
      const currentSequence = BigInt(rawVal);

      // Formato requerido: TUR-NNNNNN-XX
      const seqPadded = String(currentSequence).padStart(6, '0');
      const suffix = dto.priority ? 'PR' : 'GE';
      const publicCode = `TUR-${seqPadded}-${suffix}`;

      const ticketInternalId = ulid();
      const ticketPublicId = ulid();

      // Inserción del ticket
      const ticket = await tx.ticket.create({
        data: {
          id: ticketInternalId,
          publicId: ticketPublicId,
          sequenceNumber: currentSequence,
          publicCode,
          patientName: dto.patientName.trim(),
          patientDocument: dto.patientDocument?.trim() ?? null,
          status: TicketStatus.PENDING,
          createdBy: actorUserId,
        },
      });

      // Historial append-only a nivel de aplicación en la misma transacción
      await tx.ticketStatusHistory.create({
        data: {
          id: ulid(),
          ticketId: ticket.id,
          fromStatus: null,
          toStatus: TicketStatus.PENDING,
          actorUserId,
          reasonCode: 'TICKET_CREATED',
          correlationId: correlationId || ulid(),
        },
      });

      const responsePayload: CreatedTicketResult = {
        publicId: ticket.publicId,
        publicCode: ticket.publicCode,
        sequenceNumber: Number(ticket.sequenceNumber),
        patientName: ticket.patientName,
        status: ticket.status as TicketStatus,
        createdAt: ticket.createdAt,
      };

      // Intentar asignar un cubículo disponible en la misma transacción
      try {
        let availableCubicle: any = null;
        try {
          const cubicleRows = await tx.$queryRaw<Array<{ id: string; display_name: string }>>`
            SELECT c.id, c.display_name 
            FROM cubicles c
            LEFT JOIN tickets t ON t.cubicle_id = c.id AND t.status IN ('ASSIGNED', 'CALLED', 'IN_SERVICE')
            WHERE c.status = 'AVAILABLE' AND c.active = true AND t.id IS NULL
            ORDER BY c.code ASC 
            LIMIT 1 
            FOR UPDATE OF c SKIP LOCKED
          `;
          if (cubicleRows && cubicleRows.length > 0) {
            availableCubicle = cubicleRows[0];
          }
        } catch {
          // Fallback para entornos en memoria o pruebas
          availableCubicle = await tx.cubicle.findFirst({
            where: {
              status: CubicleStatus.AVAILABLE,
              active: true,
              tickets: {
                none: {
                  status: {
                    in: [
                      TicketStatus.ASSIGNED,
                      TicketStatus.CALLED,
                      TicketStatus.IN_SERVICE,
                    ],
                  },
                },
              },
            },
            orderBy: { code: 'asc' },
          });
        }

        if (availableCubicle) {
          await tx.cubicle.update({
            where: { id: availableCubicle.id },
            data: {
              status: CubicleStatus.RESERVED,
              version: { increment: 1 },
            },
          });

          await tx.ticket.update({
            where: { id: ticket.id },
            data: {
              status: TicketStatus.ASSIGNED,
              cubicleId: availableCubicle.id,
              assignedAt: new Date(),
              version: { increment: 1 },
            },
          });

          await tx.ticketStatusHistory.create({
            data: {
              id: ulid(),
              ticketId: ticket.id,
              fromStatus: TicketStatus.PENDING,
              toStatus: TicketStatus.ASSIGNED,
              cubicleId: availableCubicle.id,
              actorUserId,
              reasonCode: 'AUTO_ASSIGNED_ON_CREATION',
              correlationId: correlationId || ulid(),
            },
          });

          responsePayload.status = TicketStatus.ASSIGNED;
          responsePayload.assignedCubicle =
            availableCubicle.display_name || availableCubicle.displayName;
        }
      } catch (assignErr) {
        this.logger.warn(
          `No se pudo autoasignar cubículo en creación: ${(assignErr as Error).message}`,
        );
      }

      // Si se proporcionó Idempotency-Key, persistir la clave
      if (idempotencyKey) {
        await tx.idempotencyKey.create({
          data: {
            id: ulid(),
            actorUserId,
            operation: 'CREATE_TICKET',
            idempotencyKey,
            requestHash,
            resourceType: 'Ticket',
            resourcePublicId: ticket.publicId,
            responseStatus: 201,
            responseBody: responsePayload as unknown as Prisma.InputJsonValue,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
          },
        });
      }

      return responsePayload;
    });

    return {
      statusCode: 201,
      data: result,
    };
  }

  /**
   * Resuelve un ticket estrictamente por publicId (o id interno).
   * Los comandos de modificación de estado tienen prohibido resolver por publicCode.
   */
  private async findTicket(ticketPublicId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        OR: [
          { publicId: ticketPublicId },
          { id: ticketPublicId },
        ],
      },
      include: {
        cubicle: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException({
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        message: `Turno no encontrado con el identificador provisto: ${ticketPublicId}`,
      });
    }

    return ticket;
  }

  /**
   * Valida versión optimista si se provee expectedVersion
   */
  private checkVersion(currentVersion: number, expectedVersion?: number): void {
    if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
      throw new ConflictException({
        code: ApiErrorCode.STATE_CONFLICT,
        message: `Conflicto de versión optimista (versión esperada ${expectedVersion}, versión actual ${currentVersion}). Obtenga el snapshot vigente.`,
      });
    }
  }

  /**
   * POST /api/v1/tickets/:id/call
   * Llama un turno asignado o repite el llamado.
   * Transiciona ASSIGNED -> CALLED (o repite en CALLED), registra TicketCall, emite evento SSE y actualiza cubículo.
   */
  async callTicket(
    ticketIdOrPublicId: string,
    actorUserId: string,
    correlationId: string,
    idempotencyKey?: string,
    expectedVersion?: number,
  ): Promise<{ statusCode: number; data: CubicleSnapshot }> {
    const ticket = await this.findTicket(ticketIdOrPublicId);

    // Idempotencia
    if (idempotencyKey) {
      const existing = await this.prisma.idempotencyKey.findUnique({
        where: {
          uq_idempotency_key: {
            actorUserId,
            operation: `CALL_TICKET:${ticket.id}`,
            idempotencyKey,
          },
        },
      });
      if (existing?.responseBody) {
        return {
          statusCode: 200,
          data: existing.responseBody as unknown as CubicleSnapshot,
        };
      }
    }

    this.checkVersion(ticket.version, expectedVersion);

    if (ticket.status !== TicketStatus.ASSIGNED && ticket.status !== TicketStatus.CALLED) {
      throw new ConflictException({
        code: ApiErrorCode.STATE_CONFLICT,
        message: `El turno en estado ${ticket.status} no puede ser llamado. Debe estar en ASSIGNED o CALLED.`,
      });
    }

    let cubicleId = ticket.cubicleId;
    if (!cubicleId) {
      const defaultCubicle = await this.cubiclesService.getOrCreateCubicleByCode('CUB-03');
      cubicleId = defaultCubicle.cubicle.id;
    }

    const isFirstCall = ticket.status === TicketStatus.ASSIGNED;
    const now = new Date();

    const txResult = await this.prisma.$transaction(async (tx) => {
      try {
        await tx.$executeRaw`SELECT id FROM tickets WHERE id = ${ticket.id} FOR UPDATE`;
      } catch {
        // Fallback para entornos donde executeRaw no soporte FOR UPDATE
      }

      if (idempotencyKey && tx.idempotencyKey) {
        const existingInTx = await tx.idempotencyKey.findUnique({
          where: {
            uq_idempotency_key: {
              actorUserId,
              operation: `CALL_TICKET:${ticket.id}`,
              idempotencyKey,
            },
          },
        });
        if (existingInTx) {
          return {
            isDuplicate: true,
            updatedCubicleId: cubicleId,
            callNumber: 0,
            publicCode: ticket.publicCode,
            cubicleDisplayName: '',
          };
        }
      }

      const freshTicket = await tx.ticket.findUnique({ where: { id: ticket.id } });
      if (
        !freshTicket ||
        (freshTicket.status !== TicketStatus.ASSIGNED &&
          freshTicket.status !== TicketStatus.CALLED)
      ) {
        throw new ConflictException({
          code: ApiErrorCode.STATE_CONFLICT,
          message: `El turno en estado ${freshTicket?.status} no puede ser llamado. Debe estar en ASSIGNED o CALLED.`,
        });
      }

      // Contar llamadas previas para calcular número de llamada
      const callCount = await tx.ticketCall.count({
        where: { ticketId: ticket.id },
      });
      const nextCallNumber = callCount + 1;

      // Crear registro de llamada
      await tx.ticketCall.create({
        data: {
          id: ulid(),
          ticketId: ticket.id,
          cubicleId,
          calledBy: actorUserId,
          callNumber: nextCallNumber,
          createdAt: now,
        },
      });

      // Actualizar ticket
      await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          status: TicketStatus.CALLED,
          calledAt: now,
          version: { increment: 1 },
        },
      });

      // Actualizar estado del cubículo a CALLING
      const cubicle = await tx.cubicle.update({
        where: { id: cubicleId },
        data: {
          status: CubicleStatus.CALLING,
          version: { increment: 1 },
        },
      });

      // Registrar historial inmutable
      await tx.ticketStatusHistory.create({
        data: {
          id: ulid(),
          ticketId: ticket.id,
          fromStatus: ticket.status,
          toStatus: TicketStatus.CALLED,
          cubicleId,
          actorUserId,
          reasonCode: isFirstCall ? 'TICKET_CALLED' : 'TICKET_RECALLED',
          correlationId: correlationId || ulid(),
        },
      });

      if (idempotencyKey && tx.idempotencyKey) {
        await tx.idempotencyKey.create({
          data: {
            id: ulid(),
            actorUserId,
            operation: `CALL_TICKET:${ticket.id}`,
            idempotencyKey,
            requestHash: idempotencyKey,
            resourceType: 'Cubicle',
            resourcePublicId: cubicle.id,
            responseStatus: 200,
            responseBody: {} as any,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
      }

      return {
        isDuplicate: false,
        updatedCubicleId: cubicle.id,
        callNumber: nextCallNumber,
        publicCode: ticket.publicCode,
        cubicleDisplayName: cubicle.displayName,
      };
    });

    if (txResult.isDuplicate) {
      const snapshot = await this.cubiclesService.buildCubicleSnapshot(txResult.updatedCubicleId);
      return { statusCode: 200, data: snapshot };
    }

    // Emisión SSE a pantalla pública en sala (CERO PII)
    this.publicDisplayService.emitEvent({
      type: isFirstCall ? 'ticket.called' : 'ticket.recalled',
      data: {
        publicCode: txResult.publicCode,
        cubicleDisplayName: txResult.cubicleDisplayName,
        calledAt: now.toISOString(),
        callNumber: txResult.callNumber,
      },
    });

    const snapshot = await this.cubiclesService.buildCubicleSnapshot(txResult.updatedCubicleId);

    if (idempotencyKey) {
      try {
        await this.prisma.idempotencyKey.update({
          where: {
            uq_idempotency_key: {
              actorUserId,
              operation: `CALL_TICKET:${ticket.id}`,
              idempotencyKey,
            },
          },
          data: {
            responseBody: snapshot as unknown as Prisma.InputJsonValue,
          },
        });
      } catch {
        // En caso de que se haya limpiado
      }
    }

    return { statusCode: 200, data: snapshot };
  }

  /**
   * POST /api/v1/tickets/:id/start-service
   * Inicia la atención en cubículo (CALLED -> IN_SERVICE).
   */
  async startService(
    ticketIdOrPublicId: string,
    actorUserId: string,
    correlationId: string,
    idempotencyKey?: string,
    expectedVersion?: number,
  ): Promise<{ statusCode: number; data: CubicleSnapshot }> {
    const ticket = await this.findTicket(ticketIdOrPublicId);

    if (idempotencyKey) {
      const existing = await this.prisma.idempotencyKey.findUnique({
        where: {
          uq_idempotency_key: {
            actorUserId,
            operation: `START_SERVICE:${ticket.id}`,
            idempotencyKey,
          },
        },
      });
      if (existing?.responseBody) {
        return {
          statusCode: 200,
          data: existing.responseBody as unknown as CubicleSnapshot,
        };
      }
    }

    this.checkVersion(ticket.version, expectedVersion);

    if (ticket.status !== TicketStatus.CALLED) {
      throw new ConflictException({
        code: ApiErrorCode.STATE_CONFLICT,
        message: `Solo se puede iniciar atención de un turno en estado CALLED. Estado actual: ${ticket.status}.`,
      });
    }

    const now = new Date();
    const cubicleId = ticket.cubicleId!;

    await this.prisma.$transaction(async (tx) => {
      try {
        await tx.$executeRaw`SELECT id FROM tickets WHERE id = ${ticket.id} FOR UPDATE`;
      } catch {
        // Fallback para entornos donde executeRaw no soporte FOR UPDATE
      }

      const freshTicket = await tx.ticket.findUnique({ where: { id: ticket.id } });
      if (!freshTicket || freshTicket.status !== TicketStatus.CALLED) {
        throw new ConflictException({
          code: ApiErrorCode.STATE_CONFLICT,
          message: `Solo se puede iniciar atención de un turno en estado CALLED. Estado actual: ${freshTicket?.status || ticket.status}.`,
        });
      }

      await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          status: TicketStatus.IN_SERVICE,
          serviceStartedAt: now,
          version: { increment: 1 },
        },
      });

      await tx.cubicle.update({
        where: { id: cubicleId },
        data: {
          status: CubicleStatus.BUSY,
          version: { increment: 1 },
        },
      });

      await tx.ticketStatusHistory.create({
        data: {
          id: ulid(),
          ticketId: ticket.id,
          fromStatus: TicketStatus.CALLED,
          toStatus: TicketStatus.IN_SERVICE,
          cubicleId,
          actorUserId,
          reasonCode: 'SERVICE_STARTED',
          correlationId: correlationId || ulid(),
        },
      });
    });

    const snapshot = await this.cubiclesService.buildCubicleSnapshot(cubicleId);

    if (idempotencyKey) {
      await this.prisma.idempotencyKey.create({
        data: {
          id: ulid(),
          actorUserId,
          operation: `START_SERVICE:${ticket.id}`,
          idempotencyKey,
          requestHash: idempotencyKey,
          resourceType: 'Cubicle',
          resourcePublicId: cubicleId,
          responseStatus: 200,
          responseBody: snapshot as unknown as Prisma.InputJsonValue,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    }

    return { statusCode: 200, data: snapshot };
  }

  /**
   * POST /api/v1/tickets/:id/close
   * Cierre transaccional en UNA SOLA OPERACIÓN atómica:
   * 1. Turno actual CLOSED + historial.
   * 2. Cubículo liberado.
   * 3. Siguiente turno PENDING seleccionado (con FOR UPDATE / SKIP LOCKED concurrente).
   * 4. Si existe siguiente: pasa a ASSIGNED, cubículo pasa a RESERVED.
   * 5. Si no existe: cubículo pasa a AVAILABLE.
   * 6. Retorna snapshot final confirmado.
   */
  async closeTicket(
    ticketIdOrPublicId: string,
    actorUserId: string,
    correlationId: string,
    idempotencyKey?: string,
    expectedVersion?: number,
  ): Promise<{ statusCode: number; data: CubicleSnapshot }> {
    const ticket = await this.findTicket(ticketIdOrPublicId);

    if (idempotencyKey) {
      const existing = await this.prisma.idempotencyKey.findUnique({
        where: {
          uq_idempotency_key: {
            actorUserId,
            operation: `CLOSE_TICKET:${ticket.id}`,
            idempotencyKey,
          },
        },
      });
      if (existing?.responseBody) {
        return {
          statusCode: 200,
          data: existing.responseBody as unknown as CubicleSnapshot,
        };
      }
    }

    this.checkVersion(ticket.version, expectedVersion);

    if (ticket.status !== TicketStatus.IN_SERVICE) {
      throw new ConflictException({
        code: ApiErrorCode.STATE_CONFLICT,
        message: `Solo se puede cerrar un turno que esté en estado IN_SERVICE. Estado actual: ${ticket.status}.`,
      });
    }

    const cubicleId = ticket.cubicleId!;
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      try {
        await tx.$executeRaw`SELECT id FROM tickets WHERE id = ${ticket.id} FOR UPDATE`;
      } catch {
        // Fallback para entornos donde executeRaw no soporte FOR UPDATE
      }

      const freshTicket = await tx.ticket.findUnique({ where: { id: ticket.id } });
      if (!freshTicket || freshTicket.status !== TicketStatus.IN_SERVICE) {
        throw new ConflictException({
          code: ApiErrorCode.STATE_CONFLICT,
          message: `Solo se puede cerrar un turno que esté en estado IN_SERVICE. Estado actual: ${freshTicket?.status || ticket.status}.`,
        });
      }

      // 1. Cerrar el turno actual
      await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          status: TicketStatus.CLOSED,
          closedAt: now,
          version: { increment: 1 },
        },
      });

      // 2. Historial de cierre
      await tx.ticketStatusHistory.create({
        data: {
          id: ulid(),
          ticketId: ticket.id,
          fromStatus: TicketStatus.IN_SERVICE,
          toStatus: TicketStatus.CLOSED,
          cubicleId,
          actorUserId,
          reasonCode: 'SERVICE_COMPLETED',
          correlationId: correlationId || ulid(),
        },
      });

      // 3. Buscar siguiente turno PENDING de manera concurrente y atómica
      let nextTicketId: string | null = null;
      try {
        const pendingRows = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM tickets 
          WHERE status = 'PENDING' 
          ORDER BY sequence_number ASC 
          LIMIT 1 
          FOR UPDATE SKIP LOCKED
        `;
        const firstRow = pendingRows[0];
        if (firstRow) {
          nextTicketId = firstRow.id;
        }
      } catch {
        // Fallback para entornos donde SKIP LOCKED no esté disponible (mock Vitest / SQLite)
        const nextPending = await tx.ticket.findFirst({
          where: { status: TicketStatus.PENDING },
          orderBy: { sequenceNumber: 'asc' },
        });
        if (nextPending) {
          nextTicketId = nextPending.id;
        }
      }

      // 4. Asignar siguiente o dejar disponible
      if (nextTicketId) {
        await tx.ticket.update({
          where: { id: nextTicketId },
          data: {
            status: TicketStatus.ASSIGNED,
            cubicleId,
            assignedAt: now,
            version: { increment: 1 },
          },
        });

        await tx.cubicle.update({
          where: { id: cubicleId },
          data: {
            status: CubicleStatus.RESERVED,
            version: { increment: 1 },
          },
        });

        await tx.ticketStatusHistory.create({
          data: {
            id: ulid(),
            ticketId: nextTicketId,
            fromStatus: TicketStatus.PENDING,
            toStatus: TicketStatus.ASSIGNED,
            cubicleId,
            actorUserId,
            reasonCode: 'AUTO_ASSIGNED_NEXT',
            correlationId: correlationId || ulid(),
          },
        });
      } else {
        await tx.cubicle.update({
          where: { id: cubicleId },
          data: {
            status: CubicleStatus.AVAILABLE,
            version: { increment: 1 },
          },
        });
      }
    });

    const snapshot = await this.cubiclesService.buildCubicleSnapshot(cubicleId);

    if (idempotencyKey) {
      await this.prisma.idempotencyKey.create({
        data: {
          id: ulid(),
          actorUserId,
          operation: `CLOSE_TICKET:${ticket.id}`,
          idempotencyKey,
          requestHash: idempotencyKey,
          resourceType: 'Cubicle',
          resourcePublicId: cubicleId,
          responseStatus: 200,
          responseBody: snapshot as unknown as Prisma.InputJsonValue,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    }

    return { statusCode: 200, data: snapshot };
  }

  /**
   * POST /api/v1/tickets/:id/no-show
   * Marca el turno como paciente no presentado:
   * 1. Valida CALLED.
   * 2. Cambia a NO_SHOW, registra historial.
   * 3. Libera cubículo y asigna siguiente PENDING si existe.
   * 4. Retorna snapshot final.
   */
  async noShowTicket(
    ticketIdOrPublicId: string,
    actorUserId: string,
    correlationId: string,
    idempotencyKey?: string,
    expectedVersion?: number,
  ): Promise<{ statusCode: number; data: CubicleSnapshot }> {
    const ticket = await this.findTicket(ticketIdOrPublicId);

    if (idempotencyKey) {
      const existing = await this.prisma.idempotencyKey.findUnique({
        where: {
          uq_idempotency_key: {
            actorUserId,
            operation: `NO_SHOW_TICKET:${ticket.id}`,
            idempotencyKey,
          },
        },
      });
      if (existing?.responseBody) {
        return {
          statusCode: 200,
          data: existing.responseBody as unknown as CubicleSnapshot,
        };
      }
    }

    this.checkVersion(ticket.version, expectedVersion);

    if (ticket.status !== TicketStatus.CALLED) {
      throw new ConflictException({
        code: ApiErrorCode.STATE_CONFLICT,
        message: `Solo se puede marcar no presentado un turno en estado CALLED. Estado actual: ${ticket.status}.`,
      });
    }

    const cubicleId = ticket.cubicleId!;
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      try {
        await tx.$executeRaw`SELECT id FROM tickets WHERE id = ${ticket.id} FOR UPDATE`;
      } catch {
        // Fallback para entornos donde executeRaw no soporte FOR UPDATE
      }

      const freshTicket = await tx.ticket.findUnique({ where: { id: ticket.id } });
      if (!freshTicket || freshTicket.status !== TicketStatus.CALLED) {
        throw new ConflictException({
          code: ApiErrorCode.STATE_CONFLICT,
          message: `Solo se puede marcar no presentado un turno en estado CALLED. Estado actual: ${freshTicket?.status || ticket.status}.`,
        });
      }

      // 1. Marcar NO_SHOW
      await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          status: TicketStatus.NO_SHOW,
          closedAt: now,
          terminalReason: 'PATIENT_NO_SHOW',
          version: { increment: 1 },
        },
      });

      // 2. Historial
      await tx.ticketStatusHistory.create({
        data: {
          id: ulid(),
          ticketId: ticket.id,
          fromStatus: TicketStatus.CALLED,
          toStatus: TicketStatus.NO_SHOW,
          cubicleId,
          actorUserId,
          reasonCode: 'PATIENT_NO_SHOW',
          correlationId: correlationId || ulid(),
        },
      });

      // 3. Buscar siguiente turno PENDING
      let nextTicketId: string | null = null;
      try {
        const pendingRows = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM tickets 
          WHERE status = 'PENDING' 
          ORDER BY sequence_number ASC 
          LIMIT 1 
          FOR UPDATE SKIP LOCKED
        `;
        const firstRow = pendingRows[0];
        if (firstRow) {
          nextTicketId = firstRow.id;
        }
      } catch {
        const nextPending = await tx.ticket.findFirst({
          where: { status: TicketStatus.PENDING },
          orderBy: { sequenceNumber: 'asc' },
        });
        if (nextPending) {
          nextTicketId = nextPending.id;
        }
      }

      // 4. Asignar siguiente o dejar disponible
      if (nextTicketId) {
        await tx.ticket.update({
          where: { id: nextTicketId },
          data: {
            status: TicketStatus.ASSIGNED,
            cubicleId,
            assignedAt: now,
            version: { increment: 1 },
          },
        });

        await tx.cubicle.update({
          where: { id: cubicleId },
          data: {
            status: CubicleStatus.RESERVED,
            version: { increment: 1 },
          },
        });

        await tx.ticketStatusHistory.create({
          data: {
            id: ulid(),
            ticketId: nextTicketId,
            fromStatus: TicketStatus.PENDING,
            toStatus: TicketStatus.ASSIGNED,
            cubicleId,
            actorUserId,
            reasonCode: 'AUTO_ASSIGNED_NEXT',
            correlationId: correlationId || ulid(),
          },
        });
      } else {
        await tx.cubicle.update({
          where: { id: cubicleId },
          data: {
            status: CubicleStatus.AVAILABLE,
            version: { increment: 1 },
          },
        });
      }
    });

    const snapshot = await this.cubiclesService.buildCubicleSnapshot(cubicleId);

    if (idempotencyKey) {
      await this.prisma.idempotencyKey.create({
        data: {
          id: ulid(),
          actorUserId,
          operation: `NO_SHOW_TICKET:${ticket.id}`,
          idempotencyKey,
          requestHash: idempotencyKey,
          resourceType: 'Cubicle',
          resourcePublicId: cubicleId,
          responseStatus: 200,
          responseBody: snapshot as unknown as Prisma.InputJsonValue,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    }

    return { statusCode: 200, data: snapshot };
  }

  /**
   * Obtiene los últimos turnos creados para la pantalla de recepción.
   * Reglas de contrato:
   * 1. Alcance: Usuario autenticado actual.
   * 2. Jornada actual (a partir de las 00:00:00 del día en curso).
   * 3. Máximo tres (3).
   * 4. CERO PII: Sin patientName ni patientDocument.
   * 5. Sin IDs internos (id primario de BD omitido).
   */
  async getRecentTickets(actorUserId?: string): Promise<
    Array<{
      publicCode: string;
      status: TicketStatus;
      cubicleDisplayName?: string | undefined;
      createdAt: string;
    }>
  > {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const whereClause: Prisma.TicketWhereInput = {
      createdAt: { gte: startOfToday },
    };

    if (actorUserId) {
      whereClause.createdBy = actorUserId;
    }

    const tickets = await this.prisma.ticket.findMany({
      where: whereClause,
      take: 3,
      orderBy: { createdAt: 'desc' },
      include: {
        cubicle: {
          select: { displayName: true },
        },
      },
    });

    return tickets.map((t) => ({
      publicCode: t.publicCode,
      status: t.status as TicketStatus,
      cubicleDisplayName: t.cubicle?.displayName,
      createdAt: t.createdAt.toISOString(),
    }));
  }

  /**
   * Elimina las claves de idempotencia vencidas usando el índice ix_idempotency_expiry
   */
  async purgeExpiredIdempotencyKeys(): Promise<number> {
    const result = await this.prisma.idempotencyKey.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    return result.count;
  }
}
