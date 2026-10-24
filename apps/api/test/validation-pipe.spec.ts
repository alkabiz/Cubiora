import { describe, it, expect } from 'vitest';
import { ValidationPipe, BadRequestException, ArgumentMetadata } from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';
import { CreateTicketDto } from '../src/modules/tickets/dto/create-ticket.dto.js';

class CreateTestDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

describe('ValidationPipe (forbidNonWhitelisted)', () => {
  const targetMetadata: ArgumentMetadata = {
    type: 'body',
    metatype: CreateTestDto,
    data: '',
  };

  it('debe aceptar datos válidos que coincidan con el DTO', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    const validPayload = { name: 'Juan' };
    const result = await pipe.transform(validPayload, targetMetadata);

    expect(result).toEqual({ name: 'Juan' });
  });

  it('debe rechazar y lanzar BadRequestException cuando se envían propiedades extra no permitidas', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    const maliciousPayload = {
      name: 'Juan',
      isAdmin: true, // Propiedad no declarada en el DTO
      role: 'ADMIN',
    };

    await expect(pipe.transform(maliciousPayload, targetMetadata)).rejects.toThrow(
      BadRequestException,
    );
  });

  describe('CreateTicketDto - Reglas de categoría y campos clínicos', () => {
    const ticketMetadata: ArgumentMetadata = {
      type: 'body',
      metatype: CreateTicketDto,
      data: '',
    };
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    it('debe aceptar payload válido con queueCategory GENERAL o PREFERENTIAL', async () => {
      const payload = {
        patientName: 'Juan Pérez',
        queueCategory: 'GENERAL',
      };
      const result = await pipe.transform(payload, ticketMetadata);
      expect(result.queueCategory).toBe('GENERAL');
    });

    it('debe rechazar categorías desconocidas como VIP o URGENTE (criterio 7)', async () => {
      const invalidPayload = {
        patientName: 'Juan Pérez',
        queueCategory: 'VIP',
      };
      await expect(pipe.transform(invalidPayload, ticketMetadata)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('debe rechazar campos clínicos o no autorizados (diagnóstico, embarazo, etc.)', async () => {
      const clinicalPayload = {
        patientName: 'Juan Pérez',
        diagnosis: 'Hipertensión',
        pregnancy: true,
      };
      await expect(pipe.transform(clinicalPayload, ticketMetadata)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
