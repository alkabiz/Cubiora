import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { CubiclesModule } from './modules/cubicles/cubicles.module';
import { PublicDisplayModule } from './modules/public-display/public-display.module';
import { CashierMetricsModule } from './modules/cashier-metrics/cashier-metrics.module';
import { OperationalTelemetryModule } from './modules/operational-telemetry/operational-telemetry.module';
import { WmsIntegrationModule } from './modules/wms-integration/wms-integration.module';
import { PharmacistsModule } from './modules/pharmacists/pharmacists.module';
import { FacilitiesModule } from './modules/facilities/facilities.module';
import { UsersModule } from './modules/users/users.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { AuthGuard } from './common/guards/auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { CsrfOriginGuard } from './common/guards/csrf-origin.guard';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    HealthModule,
    AuthModule,
    TicketsModule,
    CubiclesModule,
    PublicDisplayModule,
    CashierMetricsModule,
    OperationalTelemetryModule,
    WmsIntegrationModule,
    PharmacistsModule,
    FacilitiesModule,
    UsersModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CsrfOriginGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('{*path}');
  }
}
