import { Injectable, ConflictException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { ulid } from 'ulid';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { TicketStatus, ApiErrorCode } from '@cubiora/shared';

export interface CreatedTicketResult {
  publicId: string;
  publicCode: string;
  sequenceNumber: number;
  patientName: string;
  status: TicketStatus;
  createdAt: Date;
}

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(private readonly prisma: PrismaService) {}

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
      .update(JSON.stringify({ patientName: dto.patientName, patientDocument: dto.patientDocument, priority: dto.priority }))
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
      // Bloqueo pesimista de la fila de secuencia con FOR UPDATE
      const sequenceRows = await tx.$queryRaw<{ next_value: bigint }[]>`
        SELECT next_value 
        FROM system_sequences 
        WHERE sequence_name = 'TICKETS' 
        FOR UPDATE
      `;

      let currentSequence: bigint;
      const firstRow = sequenceRows[0];

      if (!firstRow) {
        // Inicializar secuencia si no existe
        await tx.$executeRaw`
          INSERT INTO system_sequences (sequence_name, next_value, updated_at)
          VALUES ('TICKETS', 2, NOW())
        `;
        currentSequence = BigInt(1);
      } else {
        currentSequence = BigInt(firstRow.next_value);
        await tx.$executeRaw`
          UPDATE system_sequences 
          SET next_value = next_value + 1, updated_at = NOW() 
          WHERE sequence_name = 'TICKETS'
        `;
      }

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

      // Historial inmutable en la misma transacción (WORM)
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
}
