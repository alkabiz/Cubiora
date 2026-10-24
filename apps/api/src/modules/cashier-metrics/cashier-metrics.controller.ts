import { Controller, Get } from '@nestjs/common';
import { CashierMetricsService } from './cashier-metrics.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@cubiora/shared';

@Controller('cashier-metrics')
export class CashierMetricsController {
  constructor(private readonly cashierMetricsService: CashierMetricsService) {}

  /**
   * GET /api/v1/cashier-metrics/operative-summary
   *
   * Devuelve el resumen operativo para operadores de cubículo y administradores.
   * Acceso permitido a CASHIER y ADMIN.
   * Responde 403 Forbidden a cualquier otro rol autenticado (ej. RECEPTION).
   * No incluye datos personales de pacientes.
   */
  @Roles(UserRole.CASHIER, UserRole.ADMIN)
  @Get('operative-summary')
  async getOperativeSummary() {
    const data = await this.cashierMetricsService.getOperativeSummary();
    return { success: true, data };
  }
}
