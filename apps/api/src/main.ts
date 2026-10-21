import * as dotenv from 'dotenv';
import * as path from 'path';

// ─── Carga de Entorno Protegida ───────────────────────────────────────────────
// Prioridad: archivo de desarrollo local ignorado por git (.env.development.local).
// NUNCA cargar apps/api/.env ni llamar a dotenv.config() sin ruta específica.
dotenv.config({ path: path.resolve(process.cwd(), '.env.development.local') });
dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env.development.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env.development.local') });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { initEnv, getEnv } from './config/env.validation';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // 1. Validar entorno al inicio (fail-fast si faltan variables)
  initEnv();
  const env = getEnv();

  // 2. Crear la aplicación NestJS
  const app = await NestFactory.create(AppModule);

  // 3. Seguridad con cabeceras HTTP (Helmet)
  app.use(helmet());

  // 4. Parseo de Cookies seguras firmadas con SESSION_SECRET
  app.use(cookieParser(env.SESSION_SECRET));

  // 5. Configurar CORS estricto
  const allowedOrigins = env.CORS_ORIGINS.split(',').map((origin) => origin.trim());
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID', 'Idempotency-Key'],
  });

  // 5. Prefijo global de API
  app.setGlobalPrefix('api/v1');

  // 6. Validación estricta global: rechaza propiedades desconocidas (forbidNonWhitelisted)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 7. Filtro global de excepciones estructurado
  app.useGlobalFilters(new GlobalExceptionFilter());

  // 8. Interceptor de logging con Correlation ID
  app.useGlobalInterceptors(new LoggingInterceptor());

  // 9. Cierre graceful
  app.enableShutdownHooks();

  // 10. Iniciar servidor
  await app.listen(env.PORT);
  logger.log(`Cubiora API corriendo en el puerto ${env.PORT} [${env.NODE_ENV}]`);
}

bootstrap().catch((err) => {
  new Logger('Bootstrap').error('Error fatal al arrancar la aplicación:', err);
  process.exit(1);
});
