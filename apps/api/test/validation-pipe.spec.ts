import { describe, it, expect } from 'vitest';
import { ValidationPipe, BadRequestException, ArgumentMetadata } from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';

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
});
