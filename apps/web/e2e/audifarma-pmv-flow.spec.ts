import { test, expect } from '@playwright/test';

const QueueCategory = {
  GENERAL: 'GENERAL',
  PREFERENTIAL: 'PREFERENTIAL',
  HIGH_COST: 'HIGH_COST',
  BILLING: 'BILLING',
} as const;

const TicketStatus = {
  PENDING: 'PENDING',
  ASSIGNED: 'ASSIGNED',
  CALLED: 'CALLED',
  IN_SERVICE: 'IN_SERVICE',
  CLOSED: 'CLOSED',
  NO_SHOW: 'NO_SHOW',
  CANCELLED: 'CANCELLED',
} as const;

const DispensationResolution = {
  TOTAL_DELIVERED: 'TOTAL_DELIVERED',
  PENDING_48H: 'PENDING_48H',
  PRESCRIPTION_REJECTED: 'PRESCRIPTION_REJECTED',
  CANCELLED_BY_PATIENT: 'CANCELLED_BY_PATIENT',
} as const;

/**
 * Suite E2E de Flujo Crítico de Negocio · Mega-Centro Farmacéutico Audifarma PMV
 *
 * Valida los 3 dominios operativos interconectados:
 * 1. Admisión (Quiosco / SCR-REC-001):
 *    - Captura con escáner/teclado de documento
 *    - Categoría HIGH_COST (Alto Costo / MIPRES)
 *    - Emisión idempotente de turno
 * 2. Ventanilla (Dispensador / SCR-CAJ-001):
 *    - Llamado de turno asignado en cubículo
 *    - Inicio de atención
 *    - Captura de fórmula médica RX-E2E-9001
 *    - Resolución Resolución 1604: Generar Pendiente 48h con domicilio y teléfono
 *    - Cierre atómico y liberación de puesto
 * 3. Supervisión y Auditoría (SCR-ADM-001 y SCR-ADM-003):
 *    - Torre de control con métricas en tiempo real y conmutador de densidad (Estándar vs Compacta)
 *    - Auditoría diaria con trazabilidad del turno, categoría Alto Costo y badge Pendiente 48h
 */

test.describe('[E2E PMV Audifarma] Flujo Integral de Dispensación y Auditoría', () => {
  test('Flujo completo: Admisión (Alto Costo) -> Ventanilla (Pendiente 48h) -> Torre de Control y Auditoría', async ({
    page,
  }) => {
    // ─── Estado reactivo en memoria para el mock server E2E ──────────────────
    let currentUser: any = null;

    const state = {
      generatedTicket: null as any,
      activeTicket: null as any,
      cubicleStatus: 'AVAILABLE' as 'AVAILABLE' | 'CALLING' | 'IN_SERVICE',
      closedTickets: [] as any[],
    };

    // ─── Intercepción de Rutas de API (/api/v1/*) ───────────────────────────
    await page.route('**/api/v1/**', async (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      const pathname = url.pathname;

      // 1. Auth: /api/v1/auth/me
      if (pathname.endsWith('/auth/me')) {
        if (!currentUser) {
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              message: 'No autenticado',
            }),
          });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: currentUser,
          }),
        });
        return;
      }

      // 2. Auth: /api/v1/auth/login
      if (pathname.endsWith('/auth/login') && method === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        const username = body.username || 'recepcion';

        if (username.includes('admin')) {
          currentUser = {
            publicId: 'usr-admin',
            username: 'admin',
            displayName: 'Director Técnico Farmacéutico',
            role: 'ADMIN',
            cubicleId: null,
          };
        } else if (username.includes('cajero')) {
          currentUser = {
            publicId: 'usr-cajero4',
            username: 'cajero4',
            displayName: 'Farm. S. Quintero',
            role: 'CASHIER',
            cubicleId: 'CUB-04',
          };
        } else {
          currentUser = {
            publicId: 'usr-recepcion',
            username: 'recepcion',
            displayName: 'Personal Admisión Quiosco',
            role: 'RECEPTION',
            cubicleId: null,
          };
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: currentUser,
          }),
        });
        return;
      }

      // 3. Auth: /api/v1/auth/logout
      if (pathname.endsWith('/auth/logout') && method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
        return;
      }

      // 4. Recepción: /api/v1/tickets/recent
      if (pathname.endsWith('/tickets/recent') && method === 'GET') {
        const recentList = state.generatedTicket
          ? [
              {
                publicCode: state.generatedTicket.publicCode,
                status: state.generatedTicket.status,
                queueCategory: state.generatedTicket.queueCategory,
                cubicleDisplayName: 'Cubículo 04',
                createdAt: state.generatedTicket.createdAt,
              },
            ]
          : [];

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: recentList,
          }),
        });
        return;
      }

      // 5. Recepción: POST /api/v1/tickets (Generar turno)
      if (pathname.endsWith('/tickets') && method === 'POST') {
        const payload = JSON.parse(route.request().postData() || '{}');
        const newTicket = {
          publicId: '01JBCDEF000000000000000099',
          publicCode: 'TUR-000099-ES',
          sequenceNumber: 99,
          patientName: payload.patientName,
          patientDocument: payload.patientDocument,
          queueCategory: payload.queueCategory || QueueCategory.HIGH_COST,
          status: TicketStatus.ASSIGNED,
          createdAt: new Date().toISOString(),
          version: 1,
        };

        state.generatedTicket = newTicket;
        state.activeTicket = {
          id: 'tk-99',
          publicId: newTicket.publicId,
          publicCode: newTicket.publicCode,
          patientName: newTicket.patientName,
          maskedDocument: 'CC ***789',
          status: TicketStatus.ASSIGNED,
          version: 1,
          calledAt: null,
          callNumber: 0,
        };
        state.cubicleStatus = 'AVAILABLE';

        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: newTicket,
          }),
        });
        return;
      }

      // 6. Ventanilla: /api/v1/cubicles/*/daily-performance
      if (pathname.includes('/daily-performance')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              cubicleCode: 'CUB-04',
              completedTickets: 18,
              averageServiceSeconds: 310,
              targetSeconds: 720,
              targetCompliancePercentage: 97.4,
              calculatedAt: new Date().toISOString(),
            },
          }),
        });
        return;
      }

      // 7. Ventanilla: GET /api/v1/cubicles/*/current
      if (pathname.endsWith('/current') && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              cubicle: {
                id: 'cub-4',
                code: 'CUB-04',
                displayName: 'Cubículo 04',
                status: state.cubicleStatus,
                version: 1,
              },
              activeTicket: state.activeTicket,
              waitingCount: state.activeTicket ? 0 : 2,
              serverTime: new Date().toISOString(),
            },
          }),
        });
        return;
      }

      // 8. Ventanilla: POST /api/v1/tickets/*/call
      if (pathname.endsWith('/call') && method === 'POST') {
        if (state.activeTicket) {
          state.activeTicket.status = TicketStatus.CALLED;
          state.activeTicket.calledAt = new Date().toISOString();
          state.activeTicket.callNumber = 1;
          state.activeTicket.version = 2;
        }
        state.cubicleStatus = 'CALLING';

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              cubicle: {
                id: 'cub-4',
                code: 'CUB-04',
                displayName: 'Cubículo 04',
                status: 'CALLING',
                version: 2,
              },
              activeTicket: state.activeTicket,
              waitingCount: 0,
              serverTime: new Date().toISOString(),
            },
          }),
        });
        return;
      }

      // 9. Ventanilla: POST /api/v1/tickets/*/start-service
      if (pathname.endsWith('/start-service') && method === 'POST') {
        if (state.activeTicket) {
          state.activeTicket.status = TicketStatus.IN_SERVICE;
          state.activeTicket.serviceStartedAt = new Date().toISOString();
          state.activeTicket.version = 3;
        }
        state.cubicleStatus = 'IN_SERVICE';

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              cubicle: {
                id: 'cub-4',
                code: 'CUB-04',
                displayName: 'Cubículo 04',
                status: 'IN_SERVICE',
                version: 3,
              },
              activeTicket: state.activeTicket,
              waitingCount: 0,
              serverTime: new Date().toISOString(),
            },
          }),
        });
        return;
      }

      // 10. Ventanilla: POST /api/v1/tickets/*/close
      if (pathname.endsWith('/close') && method === 'POST') {
        const closeData = JSON.parse(route.request().postData() || '{}');
        const closedAt = new Date().toISOString();

        const closedRecord = {
          id: 'aud_e2e_99',
          publicId: state.activeTicket?.publicId || '01JBCDEF000000000000000099',
          publicCode: state.activeTicket?.publicCode || 'TUR-000099-ES',
          patientName: state.activeTicket?.patientName || 'Rosa Elena Restrepo',
          status: TicketStatus.CLOSED,
          queueCategory: QueueCategory.HIGH_COST,
          assignedStation: 'Cubículo 04',
          cubicleCode: 'CUB-04',
          operatorName: 'Farm. S. Quintero',
          serviceDurationSeconds: 180,
          waitingDurationSeconds: 65,
          slaCompliant: true,
          createdAt: state.generatedTicket?.createdAt || new Date(Date.now() - 300000).toISOString(),
          calledAt: state.activeTicket?.calledAt,
          serviceStartedAt: state.activeTicket?.serviceStartedAt,
          closedAt,
          dispensation: {
            id: 'disp_e2e_99',
            ticketId: 'tk-99',
            resolution: closeData.resolution || DispensationResolution.PENDING_48H,
            prescriptionCode: closeData.prescriptionCode || 'RX-E2E-9001',
            deliveryAddress: closeData.deliveryAddress,
            deliveryPhone: closeData.deliveryPhone,
            deliveryDeadline: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
            createdAt: closedAt,
          },
        };

        state.closedTickets.unshift(closedRecord);
        state.activeTicket = null;
        state.cubicleStatus = 'AVAILABLE';

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              cubicle: {
                id: 'cub-4',
                code: 'CUB-04',
                displayName: 'Cubículo 04',
                status: 'AVAILABLE',
                version: 4,
              },
              activeTicket: null,
              waitingCount: 0,
              serverTime: new Date().toISOString(),
            },
          }),
        });
        return;
      }

      // 11. Auditoría: GET /api/v1/tickets/history*
      if (pathname.includes('/tickets/history')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              items: state.closedTickets,
              total: state.closedTickets.length,
              page: 1,
              limit: 100,
              totalPages: 1,
            },
          }),
        });
        return;
      }

      // Fallback genérico para cualquier otra ruta de la API
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // PASO 1: ADMISIÓN (QUIOSCO TÁCTIL Y ALTO COSTO)
    // ═════════════════════════════════════════════════════════════════════════
    console.log('[E2E PMV Audifarma] Iniciando Paso 1: Admisión (Quiosco)');

    // 1.1 Iniciar sesión como recepcion
    await page.goto('/login');
    await page.waitForSelector('input[name="username"]');
    await page.fill('input[name="username"]', 'recepcion');
    await page.fill('input[name="password"]', 'audifarma123');
    await page.click('button[type="submit"]');

    // 1.2 Validar navegación a la vista de quiosco
    await page.waitForURL('**/recepcion');
    await expect(page.getByRole('heading', { name: 'Generar turno' })).toBeVisible();

    // 1.3 Digitar nombre del paciente
    await page.fill('#patientName', 'Rosa Elena Restrepo');

    // 1.4 Simular escaneo de documento (cédula colombiana / PDF417)
    const scanBtn = page.getByRole('button', { name: /Escanear Cédula/i });
    await expect(scanBtn).toBeVisible();
    await scanBtn.click();

    // Comprobar que el campo documento capturó el valor escaneado
    const docInput = page.locator('#patientDocument');
    await expect(docInput).toHaveValue('1023456789');

    // 1.5 Seleccionar categoría Alto Costo / MIPRES
    const highCostOption = page.locator('label, div').filter({ hasText: 'Alto Costo / MIPRES' }).first();
    await highCostOption.click();

    // 1.6 Emitir el turno mediante el botón principal
    const submitBtn = page.locator('#btn-generar-turno');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 1.7 Verificar que el turno TUR-000099-ES se emitió y aparece en el comprobante y tabla reciente
    await expect(page.locator('text=TUR-000099-ES').first()).toBeVisible({ timeout: 5000 });
    console.log('[E2E PMV Audifarma] Paso 1 Completado: Turno TUR-000099-ES emitido con éxito.');

    // ═════════════════════════════════════════════════════════════════════════
    // PASO 2: VENTANILLA DEL DISPENSADOR (FÓRMULA Y PENDIENTE 48H)
    // ═════════════════════════════════════════════════════════════════════════
    console.log('[E2E PMV Audifarma] Iniciando Paso 2: Ventanilla (Dispensador)');

    // 2.1 Limpiar sesión y autenticar como cajero de cubículo especializado CUB-04
    currentUser = null;
    await page.evaluate(() => sessionStorage.clear());
    await page.goto('/login');
    await page.waitForSelector('input[name="username"]');
    await page.fill('input[name="username"]', 'cajero4');
    await page.fill('input[name="password"]', 'audifarma123');
    await page.click('button[type="submit"]');

    // 2.2 Validar navegación a Mi Cubículo
    await page.waitForURL('**/cajero');
    await expect(page.getByRole('heading', { name: 'Mi cubículo' })).toBeVisible();

    // 2.3 Verificar turno asignado TUR-000099-ES en ventanilla
    await expect(page.locator('text=TUR-000099-ES').first()).toBeVisible();

    // 2.4 Llamar turno
    const callButton = page.getByRole('button', { name: /Llamar turno/i });
    await expect(callButton).toBeVisible();
    await callButton.click();

    // 2.5 Iniciar atención del paciente en ventanilla
    const startServiceButton = page.getByRole('button', { name: /Iniciar atención/i });
    await expect(startServiceButton).toBeVisible();
    await startServiceButton.click();

    // 2.6 En atención: Ingresar el código de barras de la fórmula médica (RX-E2E-9001)
    const barcodeInput = page.locator('#prescription-barcode-input');
    await expect(barcodeInput).toBeVisible();
    await barcodeInput.fill('RX-E2E-9001');

    // 2.7 Pulsar "Cerrar turno" para abrir el modal de resolución farmacéutica
    const closeTriggerBtn = page.getByRole('button', { name: /Cerrar turno/i });
    await expect(closeTriggerBtn).toBeVisible();
    await closeTriggerBtn.click();

    // 2.8 En el modal: Seleccionar "Generar Pendiente 48h" (Resolución 1604)
    const modalDialog = page.locator('div[role="dialog"]');
    await expect(modalDialog).toBeVisible();

    const pending48Btn = modalDialog.getByRole('button', { name: /Generar Pendiente 48h/i });
    await expect(pending48Btn).toBeVisible();
    await pending48Btn.click();

    // 2.9 Completar los datos obligatorios de entrega domiciliaria
    const addressInput = page.locator('#delivery-address-input');
    const phoneInput = page.locator('#delivery-phone-input');
    await expect(addressInput).toBeVisible();
    await expect(phoneInput).toBeVisible();

    await addressInput.fill('Calle 50 # 40-12, Medellín');
    await phoneInput.fill('3001234567');

    // 2.10 Confirmar cierre de turno y liberación de cubículo
    const confirmCloseBtn = modalDialog.getByRole('button', { name: /Cerrar turno y liberar cubículo/i });
    await expect(confirmCloseBtn).toBeVisible();
    await confirmCloseBtn.click();

    // 2.11 Verificar que el diálogo se cierra y el cubículo vuelve a estar disponible
    await expect(modalDialog).not.toBeVisible();
    await expect(page.locator('text=Disponible').first()).toBeVisible();
    console.log('[E2E PMV Audifarma] Paso 2 Completado: Turno cerrado con Pendiente 48h y dirección domiciliaria.');

    // ═════════════════════════════════════════════════════════════════════════
    // PASO 3: TORRE DE CONTROL Y AUDITORÍA DIARIA (SCR-ADM-001 & SCR-ADM-003)
    // ═════════════════════════════════════════════════════════════════════════
    console.log('[E2E PMV Audifarma] Iniciando Paso 3: Torre de Control y Auditoría');

    // 3.1 Limpiar sesión y autenticar como Administrador / Director Técnico
    currentUser = null;
    await page.evaluate(() => sessionStorage.clear());
    await page.goto('/login');
    await page.waitForSelector('input[name="username"]');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'audifarma123');
    await page.click('button[type="submit"]');

    // 3.2 Navegar a Torre de Control (Supervisión Operativa SCR-ADM-001)
    await page.goto('/admin/supervision');
    await expect(page.getByRole('heading', { name: /Estado General Operativo/i })).toBeVisible();

    // 3.3 Verificar renderizado de métricas operativas clave
    await expect(page.locator('text=Cubículos activos')).toBeVisible();
    await expect(page.locator('text=Finalizados hoy')).toBeVisible();

    // 3.4 Verificar y conmutar densidad de pantalla (Estándar vs Compacta Mega-Centro)
    const compactDensityBtn = page.getByRole('button', { name: /Compacta Mega-Centro/i });
    const standardDensityBtn = page.getByRole('button', { name: /Estándar \(2 col\)/i });

    await expect(compactDensityBtn).toBeVisible();
    await expect(standardDensityBtn).toBeVisible();

    // Conmutar a modo compacto
    await compactDensityBtn.click();
    await expect(compactDensityBtn).toHaveAttribute('aria-pressed', 'true');

    // Volver a modo estándar
    await standardDensityBtn.click();
    await expect(standardDensityBtn).toHaveAttribute('aria-pressed', 'true');

    // 3.5 Navegar a Auditoría Diaria (SCR-ADM-003)
    await page.goto('/admin/historial');
    await page.waitForSelector('table');

    // 3.6 Verificar que el turno TUR-000099-ES aparece registrado en la tabla
    const ticketRow = page.locator('tr').filter({ hasText: 'TUR-000099-ES' });
    await expect(ticketRow).toBeVisible();

    // 3.7 Comprobar que refleja la categoría Alto Costo y la resolución Pendiente 48h
    await expect(ticketRow.locator('text=Alto Costo')).toBeVisible();
    await expect(ticketRow.locator('text=Pendiente 48h')).toBeVisible();

    // 3.8 Comprobar el filtro de búsqueda interactivo por código
    const searchInput = page.getByPlaceholder(/Buscar por código de turno o puesto/i);
    await searchInput.fill('TUR-000099');
    await expect(ticketRow).toBeVisible();

    console.log('[E2E PMV Audifarma] Paso 3 Completado: Auditoría diaria y supervisión validadas con 100% de éxito.');
  });
});
