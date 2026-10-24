import { Module } from '@nestjs/common';
import { CashierMetricsController } from './cashier-metrics.controller';
import { CashierMetricsService } from './cashier-metrics.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CashierMetricsController],
  providers: [CashierMetricsService],
})
export class CashierMetricsModule {}
