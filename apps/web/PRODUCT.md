# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Personal de recepción y admisión en sala (y pacientes en quiosco táctil):** emiten turnos mediante ingreso de datos mínimos, lectura de cédula por escáner PDF417 o teclado numérico táctil integrado.
- **Operadores de ventanilla / dispensadores farmacéuticos:** llaman turnos asignados, validan fórmulas médicas (Code128), atienden y cierran el despacho ya sea por entrega total o radicando un pendiente domiciliario de <=48 horas.
- **Directores técnicos y supervisores administrativos multi-sede:** monitorean la telemetría en tiempo real de cubículos y colas, responden a recomendaciones prescriptivas sobre cuellos de botella, parametrizan sedes, puestos, químicos/regentes farmacéuticos y usuarios, y auditan el historial diario exportable.
- **Pacientes y acompañantes en sala de espera (incluidos preferenciales SIAU):** consultan los llamados visuales y sonoros en la pantalla pública de 10-foot UI sin exposición de identidad.

## Product Purpose

Cubiora es una plataforma web presencial de gestión inteligente de turnos, llamado en sala y trazabilidad de dispensación para dispensarios y mega-centros farmacéuticos en Colombia. Resuelve la congestión en ventanillas, la asignación concurrente sin colisiones y la trazabilidad regulatoria desde la admisión hasta el cierre farmacéutico. El éxito operativo consiste en dirigir cada tipología de usuario al cubículo adecuado, mantener la privacidad estricta en monitores de sala y dejar evidencia auditable del cumplimiento de tiempos de espera y plazos legales de entrega pendiente (<=48 horas).

## Positioning

A diferencia de turneros genéricos de atención comercial, Cubiora integra de origen el flujo normativo de dispensación ambulatoria en Colombia para operaciones de alta escala (20+ cubículos por sede): segmentación multicanal (`GENERAL`, `PREFERENTIAL`, `HIGH_COST` / MIPRES, `BILLING`), cierre farmacéutico con radicación legal de pendientes de domicilio en <=48 horas (Resolución 1604 de 2013 MinSalud), priorización SIAU / Ley 1171, detector prescriptivo de cuellos de botella en tiempo real, interoperabilidad preparada para pre-alistamiento en bodega (WMS/ERP mediante webhooks firmados HMAC-SHA256) y aislamiento Zero-PII en pantalla pública (Ley 1581 de 2012). *Audifarma* se registra únicamente como caso de estudio piloto de validación del PMV, no como marca ni cliente exclusivo del producto.

## Operating Context

- **Entorno físico y hardware:** puntos de admisión y quioscos táctiles de 10-15" (con teclado numérico en pantalla), pistolas lectoras USB emuladas para PDF417 (cédula) y Code128 (fórmula EPS), estaciones de cubículo operables por teclado mediante atajos configurables (`Ctrl+Shift+K/J/M`) y televisores o monitores de sala con audio sintetizado mediante Web Audio API (sin archivos multimedia externos).
- **Arquitectura operativa y conectividad:** aplicación SPA servida detrás de Nginx y proxy inverso en producción (Cloudflare Tunnel / Coolify con cabecera CSP productiva en `docker/nginx.conf`), conectada al backend NestJS y PostgreSQL (`FOR UPDATE SKIP LOCKED`) vía REST con cookies HTTP-only, SSE en `/pantalla` con snapshot de recuperación y Socket.IO en `/operational-telemetry`. En ventanilla, la interfaz exige reconciliación explícita ante respuestas ambiguas o pérdida de red antes de habilitar reintentos.
- **Alcance excluido del PMV:** no gestiona inventario ni existencias de farmacia, historia clínica electrónica ni prescripción/formulación médica directa.

## Capabilities and Constraints

- **Restricciones obligatorias de frontend (`.agents/rules/frontend-directive.md`):** React 19, TypeScript estricto, Vite 8, Tailwind CSS v4, `@radix-ui/themes` (`<Theme accentColor="blue" grayColor="slate" radius="medium">` mapeado vía CSS a la paleta oficial Cubiora `#2c73d2`, `#0081cf`, `#0089ba`, `#008e9b`, `#008f7a` en `src/styles/index.css`) + `@radix-ui/react-*`, React Hook Form + Zod (`@hookform/resolvers/zod`) y TanStack Query. Están prohibidas otras librerías UI (MUI, Ant, Bootstrap, Chakra, etc.), wrappers preventivos, diseño decorativo (glassmorphism, neumorphism, gradientes o animaciones no funcionales) y llamadas `fetch` dispersas.
- **Privacidad y dominio clínico-administrativo:** Zero-PII estricto en la pantalla pública (`/pantalla`) y en la tabla de últimos turnos de recepción; recepción no captura diagnósticos ni clasificaciones clínicas abiertas; las mutaciones críticas exigen `Idempotency-Key` y control optimista (`expectedVersion` / `If-Match`).
- **Deuda y decisiones pendientes confirmadas:** eliminar textos residuales de piloto (*Audifarma*) y valores por defecto locales heredados de otro país (`CABA`, `+54 11`, `hs`) para alinear toda la operación al contexto colombiano; definir en campo la política `NO_SHOW_MAX_CALLS` y la estrategia final de retención/cifrado de `patient_document` (`docs/decisiones-pendientes.md`).

## Brand Commitments

- **Identidad institucional:** **Cubiora** como marca única multi-centro y multi-sede en todo el producto.
- **Voz y tono:** español institucional, clínico, preciso y directo adaptado al ecosistema farmacéutico colombiano (MinSalud, EPS, C.C., MIPRES, SIAU), orientado a reducir carga cognitiva bajo presión operativa y evitar relleno comercial o códigos técnicos internos (`SCR-*`) visibles para el usuario final.

## Evidence on Hand

- Código real del frontend en `apps/web/src/`, contratos compartidos en `packages/shared/` y auditoría normativa/PMV en `AUDIT-AUDIFARMA-PMV.md`.
- Suites automatizadas en Vitest (`apps/web/src/**/*.spec.ts(x)`), verificación programática de contraste WCAG (`apps/web/src/test/contrast-calculator.spec.ts`), benchmark de render/paginación (`apps/web/src/test/performance-evidence.spec.tsx`) y pruebas E2E Playwright + `@axe-core/playwright` (`apps/web/e2e/axe-browser.spec.ts`, `apps/web/e2e/audifarma-pmv-flow.spec.ts`) ejecutadas sobre rutas simuladas con mocks.
- **Ausencias explícitas:** no existen testimonios de clientes en producción, capturas de telemetría real en vivo ni pruebas automatizadas sobre hardware físico USB o impresoras térmicas; no se deben fabricar cifras ni citas de usuarios.

## Product Principles

- **Cero exposición pública de identidad:** las pantallas visibles al público comunican únicamente códigos de turno, prioridad y destino operativo.
- **Estado gobernado por el servidor:** ventanillas y tableros representan solo confirmaciones persistidas en backend y detienen mutaciones inciertas hasta reconciliar.
- **Eficiencia bajo alta demanda:** admisión, llamado y cierre farmacéutico deben completarse con los mínimos pasos y sin ambigüedad tanto en modo táctil como en teclado o escáner.
- **Coherencia de sistema único:** toda interfaz y flujo debe construirse directamente sobre las primitivas y tokens aprobados del sistema sin bifurcar lenguajes visuales por rol.

## Accessibility & Inclusion

- **Estándar vinculante:** **WCAG 2.2 Nivel AA** en todas las rutas administrativas, operativas y pantalla de sala (`/pantalla`).
- **Requisitos específicos:** contraste AA verificado en modo claro operativo y pantalla oscura 10-foot UI, objetivos interactivos de al menos 24x24 CSS px según SC 2.5.8 (>=44x44 px recomendado en puntos táctiles y quiosco), foco visible sin obstrucción bajo cabeceras fijas (`WCAG 2.4.11`), atajos con modificador compuesto desactivables (`WCAG 2.1.4`), soporte efectivo de `prefers-reduced-motion` preservando el cambio de estado esencial, y anuncios `aria-live` para llamados y confirmaciones clave.

