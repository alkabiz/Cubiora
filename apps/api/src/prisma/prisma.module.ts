import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * PrismaModule global — PrismaService disponible en toda la aplicación
 * sin necesidad de importar este módulo en cada módulo de dominio.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
