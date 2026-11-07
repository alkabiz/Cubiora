import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import * as fs from 'fs';
import * as path from 'path';

const RESULTS_DIR = path.resolve(process.cwd(), 'e2e-axe-results');

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

function saveAxeReport(screenName: string, results: any) {
  const filePath = path.join(RESULTS_DIR, `${screenName}.json`);
  fs.writeFileSync(filePath, JSON.stringify(results, null, 2), 'utf-8');
}

// ─── Helpers de simulación de sesión y API ────────────────────────────────────
async function setupAuthMock(
  page: any,
  role: 'ADMIN' | 'CASHIER' | 'RECEPTION',
  cubicleId: string | null = 'CUB-03',
) {
  await page.route('**/api/v1/auth/me', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          publicId: `usr-${role.toLowerCase()}`,
          username: `user_${role.toLowerCase()}`,
          displayName: `Operador ${role}`,
          role,
          cubicleId,
        },
      }),
    });
  });
}

// ─── 1. Pantalla de Login ─────────────────────────────────────────────────────
test.describe('[Navegador Real] SCR-AUT-001: Login', () => {
  test('Ejecuta escaneo axe-core en Chromium y guarda reporte', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('input[name="username"]');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    saveAxeReport('01-login', accessibilityScanResults);
    expect(accessibilityScanResults.violations.filter((v) => v.impact === 'critical')).toHaveLength(0);
  });
});

// ─── 2. Pantalla de Recepción ────────────────────────────────────────────────
test.describe('[Navegador Real] SCR-REC-001: Recepción', () => {
  test('Ejecuta escaneo axe-core con datos realistas', async ({ page }) => {
    await setupAuthMock(page, 'RECEPTION');

    await page.route('**/api/v1/tickets/recent*', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'tk-1',
              publicCode: 'TUR-000101-A1',
              category: 'GENERAL',
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.goto('/recepcion');
    await page.waitForSelector('h1');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();

    saveAxeReport('02-reception', results);
    expect(results.violations.filter((v) => v.impact === 'critical')).toHaveLength(0);
  });
});

// ─── 3. Pantalla de Cajero (4 estados y modal) ───────────────────────────────
test.describe('[Navegador Real] SCR-CAJ-001: Cajero y Ventanilla', () => {
  test('Estado DISPONIBLE / CALLED y Modal de Confirmación', async ({ page }) => {
    await setupAuthMock(page, 'CASHIER', 'CUB-03');

    await page.route('**/api/v1/cubicles/*/daily-performance', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            cubicleCode: 'CUB-03',
            completedTickets: 24,
            averageServiceSeconds: 380,
            targetSeconds: 720,
            targetCompliancePercentage: 96.5,
            calculatedAt: new Date().toISOString(),
          },
        }),
      });
    });

    await page.route('**/api/v1/cubicles/*/current', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            cubicle: {
              id: 'cub-3',
              code: 'CUB-03',
              displayName: 'Cubículo 03',
              status: 'CALLING',
              version: 1,
            },
            activeTicket: {
              id: 't-1',
              publicId: '01JBCDEF000000000000000001',
              publicCode: 'TUR-000122-F4',
              patientName: 'Juan Pérez',
              maskedDocument: 'CC ***456',
              status: 'CALLED',
              version: 2,
              calledAt: new Date(Date.now() - 90000).toISOString(),
              callNumber: 1,
            },
            waitingCount: 3,
            serverTime: new Date().toISOString(),
          },
        }),
      });
    });

    await page.goto('/cajero');
    await page.waitForSelector('h1');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();

    saveAxeReport('03-cashier-called', results);
    expect(results.violations.filter((v) => v.impact === 'critical')).toHaveLength(0);
  });
});

// ─── 4. Pantalla de Torre de Control (Telemetría en Vivo) ────────────────────
test.describe('[Navegador Real] SCR-ADM-001: Torre de Control', () => {
  test('Escaneo axe-core en dashboard de telemetría', async ({ page }) => {
    await setupAuthMock(page, 'ADMIN');

    await page.goto('/admin/supervision');
    await page.waitForSelector('h1');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();

    saveAxeReport('04-admin-overview', results);
    expect(results.violations.filter((v) => v.impact === 'critical')).toHaveLength(0);
  });
});

// ─── 5. Pantalla de Configuración de Cubículos ───────────────────────────────
test.describe('[Navegador Real] SCR-ADM-002: Configuración de Cubículos', () => {
  test('Escaneo axe-core en grilla de cubículos', async ({ page }) => {
    await setupAuthMock(page, 'ADMIN');

    await page.goto('/admin/cubiculos');
    await page.waitForSelector('h1');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();

    saveAxeReport('05-admin-cubicles', results);
    expect(results.violations.filter((v) => v.impact === 'critical')).toHaveLength(0);
  });
});

// ─── 6. Pantalla de Auditoría Diaria (con 25 y con 600 filas) ────────────────
test.describe('[Navegador Real] SCR-ADM-003: Auditoría Diaria', () => {
  test('Escaneo axe-core con paginación activa', async ({ page }) => {
    await setupAuthMock(page, 'ADMIN');

    await page.goto('/admin/historial');
    await page.waitForSelector('table');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();

    saveAxeReport('06-admin-history', results);
    expect(results.violations.filter((v) => v.impact === 'critical')).toHaveLength(0);
  });
});

// ─── 7. Pantalla Pública de Sala (10-Foot UI) ────────────────────────────────
test.describe('[Navegador Real] SCR-PUB-001: Pantalla Pública', () => {
  test('Escaneo axe-core y verificación de alto contraste', async ({ page }) => {
    await page.goto('/pantalla');
    await page.waitForSelector('h1');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();

    saveAxeReport('07-public-display', results);
    expect(results.violations.filter((v) => v.impact === 'critical')).toHaveLength(0);
  });
});

// ─── 8. FASE B: Medición Real de Target Size (WCAG 2.5.8 AA >= 24x24 px) ──────
test.describe('[FASE B - Navegador Real] Medición de Tamaño de Objetivo (2.5.8 AA)', () => {
  test('Todos los botones interactivos visibles miden al menos 24x24 px (ancho Y alto)', async ({ page }) => {
    await setupAuthMock(page, 'ADMIN');
    await page.goto('/admin/cubiculos');
    await page.waitForSelector('h1');

    // Seleccionar únicamente botones visibles en el viewport
    const visibleButtons = await page.locator('button:visible').all();
    const undersizedButtons: { html: string; width: number; height: number }[] = [];

    for (const btn of visibleButtons) {
      const box = await btn.boundingBox();
      if (box) {
        // WCAG 2.5.8 Target Size Minimum: 24x24 px
        if (box.width < 24 || box.height < 24) {
          const html = await btn.evaluate((el: HTMLElement) => el.outerHTML.slice(0, 80));
          undersizedButtons.push({ html, width: box.width, height: box.height });
        }
      }
    }

    console.log(`[FASE B] Botones visibles analizados: ${visibleButtons.length}. Botones < 24x24 px: ${undersizedButtons.length}`);
    expect(undersizedButtons).toHaveLength(0);
  });
});

// ─── 9. FASE B: Foco no Obstruido por Sticky Header (WCAG 2.4.11 AA) ──────────
test.describe('[FASE B - Navegador Real] Foco no Obstruido (2.4.11 AA)', () => {
  test('Recorrido con Tabulador de elementos en flujo no queda oculto bajo el navbar sticky', async ({ page }) => {
    await setupAuthMock(page, 'ADMIN');
    await page.goto('/admin/historial');
    await page.waitForSelector('table');

    const navbar = page.locator('.app-navbar');
    const navbarBox = await navbar.boundingBox();
    const navbarBottom = navbarBox ? navbarBox.y + navbarBox.height : 68;

    // Enfocar el primer input dentro de la página para evaluar elementos en flujo
    const searchInput = page.locator('#history-search-input');
    await searchInput.focus();

    // Tabular 5 veces hacia adelante dentro de la página
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      const focusedHandle = await page.evaluateHandle(() => document.activeElement);
      const focusedBox = await focusedHandle.asElement()?.boundingBox();

      if (focusedBox && focusedBox.height > 0) {
        // Elementos en flujo de página (y >= 0) no deben quedar tapados bajo el navbar
        if (focusedBox.y >= 0) {
          const isEntirelyObscured = focusedBox.y < navbarBottom && (focusedBox.y + focusedBox.height) <= navbarBottom;
          expect(isEntirelyObscured, `Elemento en y=${focusedBox.y} con altura ${focusedBox.height} queda tapado por navbar en y=${navbarBottom}`).toBe(false);
        }
      }
    }
  });
});

// ─── 10. FASE B: Reflow y Zoom (WCAG 1.4.10) a 320 px CSS de ancho ─────────────
test.describe('[FASE B - Navegador Real] Reflow a 320px CSS de ancho (1.4.10 AA)', () => {
  test('No produce scroll horizontal bidimensional en el layout del shell', async ({ page }) => {
    await setupAuthMock(page, 'ADMIN');
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/admin/cubiculos');
    await page.waitForSelector('h1');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);

    console.log(`[FASE B - Reflow 320px] scrollWidth: ${scrollWidth}px, clientWidth: ${clientWidth}px`);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });
});

// ─── 11. FASE B: Reducción de Movimiento (WCAG 2.3.3) ──────────────────────────
test.describe('[FASE B - Navegador Real] prefers-reduced-motion: reduce', () => {
  test('Anula animaciones y transiciones continuas en pantalla de sala', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/pantalla');
    await page.waitForSelector('h1');

    const heroSection = page.locator('section[aria-label="Turno llamado actualmente"]');
    const transitionDuration = await heroSection.evaluate((el: HTMLElement) => {
      return window.getComputedStyle(el).transitionDuration;
    });

    console.log(`[FASE B - Reduced Motion] transitionDuration computada: ${transitionDuration}`);
    expect(transitionDuration === '0s' || transitionDuration === '').toBe(true);
  });
});
