import { Controller, Get } from '@nestjs/common';
import { CashierMetricsService } from './cashier-metrics.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@cubiora/shared';

@Controller('cashier-metrics')
export class CashierMetricsController {
  constructor(private readonly cashierMetricsService: CashierMetricsService) {}

  /**
   * GET /api/v1/cashier-metrics/operative-summary
   *
   * Devuelve el resumen operativo para operadores de cubículo y administradores.
   * CASHIER queda estrictamente acotado a su cubículo asignado; ADMIN consulta global/sede primaria.
   * Acceso permitido a CASHIER y ADMIN.
   * Responde 403 Forbidden a cualquier otro rol autenticado (ej. RECEPTION).
   * No incluye datos personales de pacientes.
   */
  @Roles(UserRole.CASHIER, UserRole.ADMIN)
  @Get('operative-summary')
  async getOperativeSummary(@CurrentUser() user?: AuthenticatedUser) {
    const data = await this.cashierMetricsService.getOperativeSummary(user);
    return { success: true, data };
  }
}
