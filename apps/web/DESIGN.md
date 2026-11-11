---
name: Cubiora
description: Sistema de diseño clínico-operativo de alta legibilidad para gestión de turnos, ventanillas farmacéuticas y pantallas de sala en Colombia.
colors:
  brand-cobalt: "#2c73d2"
  brand-cerulean: "#0081cf"
  brand-ocean: "#0089ba"
  brand-lagoon: "#008e9b"
  brand-confirm: "#008f7a"
  canvas-slate: "#f1f5f9"
  surface-white: "#ffffff"
  surface-subtle: "#f8fafc"
  hairline-slate: "#e2e8f0"
  slate-control-border: "#64748b"
  slate-muted: "#475569"
  ink-slate: "#0f172a"
  hall-void: "#020617"
  hall-secondary-slate: "#cbd5e1"
  status-warning: "#92400e"
  status-danger: "#b42318"
typography:
  display:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "clamp(2.25rem, 6vw, 6rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "IBM Plex Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(1.65rem, 2.1vw, 2.1rem)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  headline-mobile:
    fontFamily: "IBM Plex Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  title:
    fontFamily: "IBM Plex Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: "IBM Plex Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0em"
  compact:
    fontFamily: "IBM Plex Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0em"
  label:
    fontFamily: "IBM Plex Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.08em"
  micro:
    fontFamily: "IBM Plex Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.02em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  2xl: "16px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.brand-cobalt}"
    textColor: "{colors.surface-white}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.brand-cobalt}"
    boxShadow: "inset 0 0 0 100vmax rgb(2 6 23 / 0.14)"
  button-secondary:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink-slate}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
    height: "40px"
  card-surface:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink-slate}"
    rounded: "{rounded.xl}"
    padding: "20px"
  input-control:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink-slate}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
  nav-link-active:
    backgroundColor: "rgb(44 115 210 / 0.10)"
    textColor: "{colors.ink-slate}"
    borderColor: "{colors.brand-cobalt}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "10px 12px"
    height: "44px"
  status-badge-online:
    backgroundColor: "rgb(0 143 122 / 0.12)"
    textColor: "{colors.ink-slate}"
    borderColor: "{colors.brand-confirm}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "3px 9px"
---

# Design System: Cubiora

## Overview

**Creative North Star: "The Clinical Precision Bench"**

Cubiora está diseñado como un banco de instrumentación clínica: sereno, estructurado y de lectura instantánea bajo presión operativa. Cada estación —desde un quiosco táctil de admisión hasta un cubículo con 20+ puestos simultáneos o un televisor de sala a tres metros— privilegia la jerarquía tipográfica clara, superficies planas delimitadas por líneas nítidas y confirmaciones gobernadas por el servidor.

El sistema combina Radix Themes (`accentColor="blue"`, `grayColor="slate"`, `radius="medium"`, sobrescrito en `src/styles/index.css`) con tipografía autoalojada y la paleta cromática oficial de 5 tonos exactos de Cubiora (`#2c73d2`, `#0081cf`, `#0089ba`, `#008e9b`, `#008f7a`) para operar en redes hospitalarias aisladas y entornos detrás de Cloudflare Tunnel sin depender de fuentes externas. Rechaza cualquier ornamento que compita con la seguridad farmacéutica: cero glassmorphism, cero neumorphism, cero gradientes decorativos y cero exposición pública de datos personales (Ley 1581 de 2012).

**Key Characteristics:**
- Paleta institucional obligatoria de 5 hexes exactos (`#2c73d2`, `#0081cf`, `#0089ba`, `#008e9b`, `#008f7a`) sin tonos derivados paralelos, respaldada por escala neutra Slate (`#f1f5f9`, `#ffffff`, `#f8fafc`, `#e2e8f0`, `#64748b`, `#475569`, `#0f172a`, `#020617`).
- Dúo tipográfico técnico autoalojado: **IBM Plex Sans** para UI y flujos clínicos y **JetBrains Mono** tabular para códigos de turno y cronómetros.
- Superficies planas estructuradas mediante bordes de 1px y contraste verificable WCAG 2.2 Nivel AA en modo claro operativo y pantalla oscura 10-foot UI (`/pantalla`).
- Estados interactivos disciplinados que bloquean reintentos ambiguos y comunican pérdida de conectividad sin relleno visual.

## Colors

Toda la interfaz de Cubiora utiliza estrictamente los 5 colores oficiales de marca, neutros Slate puros y excepciones clínicas Rojo/Ámbar reservadas exclusivamente a errores, acciones destructivas o alertas preventivas.

### Brand Palette (Mandatory 5 Hexes)
- **Brand Cobalt** (`#2c73d2`): Color maestro primario (`--app-primary`, `--app-focus`). Único hex de marca con contraste `4.68:1 >= 4.5:1` sobre `#ffffff` (botón CTA sólido `text-white`, enlaces de acento sobre blanco, foco de teclado WCAG 2.4.7, indicador activo de navegación lateral, rol de usuario y categoría `GENERAL`).
- **Brand Cerulean** (`#0081cf`): Acento secundario activo (`--app-secondary`) para puestos en atención (`IN_SERVICE` / `ATENDIENDO`), prioridad `PREFERENTIAL`, barra horaria activa y roles operativos adjuntos.
- **Brand Ocean** (`#0089ba`): Acento informativo (`--app-info`) para turnos asignados (`ASSIGNED`), categoría `HIGH_COST` / MIPRES, iconos KPI y barra informativa en monitor público.
- **Brand Lagoon** (`#008e9b`): Acento transicional/progreso (`--app-progress`) para estado `CALLED` (`LLAMANDO`), categoría `BILLING` y spinners de sincronización o reconciliación.
- **Brand Confirm** (`#008f7a`): Acento de confirmación (`--app-success`) para `AVAILABLE`, `DELIVERED`, `EN LÍNEA`, `SEDE EN USO`, banner de operación nominal y destino activo en `/pantalla`. Sobre fondos claros se emplea con tinta `#0f172a` en tinte suave `rgb(0 143 122 / 0.12)` + borde `#008f7a` (`~15.5:1`), o sólido `#008f7a` con tinta `#020617` (`5.02:1`).

### Neutral & Clinical Exception Tones
- **Canvas Slate** (`#f1f5f9`), **Surface White** (`#ffffff`), **Surface Subtle** (`#f8fafc`) y **Hairline Slate** (`#e2e8f0`): Planos neutros para separar tarjetas y tablas sin sombras difusas.
- **Ink Slate** (`#0f172a`), **Slate Muted** (`#475569`) y **Slate Control Border** (`#64748b`): Tipografía principal (`17:1`), secundaria (`7.6:1`) y bordes de control `>= 3.0:1` (`4.76:1`).
- **Public Hall Dark Palette** (`#020617`, `#0f172a`, `#cbd5e1`, `#008f7a`): Uso exclusivo en `/pantalla` (10-foot UI); texto blanco `#ffffff` en cápsulas con tinte `/20` de `#008f7a`, `#0081cf` o `#0089ba` (`> 12:1`), y `#008f7a` directo sobre `#020617` (`5.02:1`).
- **Clinical Warning & Danger Exceptions** (`#92400e` / Ámbar, `#b42318` / Rojo): Reservados estrictamente a `PENDING_48H`, `ON_LEAVE`, `MAINTENANCE`, cuello de botella, `NO_SHOW`, `SLA_EXCEDIDO`, desconexión y errores.

### Named Rules
**The Strict 5-Color Brand Rule.** Fuera de neutros Slate y alertas clínicas Rojo/Ámbar, queda prohibida cualquier otra referencia cromática o hex derivado; la jerarquía se construye únicamente con los 5 hexes oficiales, opacidades (`/10`, `/12`, `/20`) y sombreado neutro por superposición.

**The AA Ink-Over-Tint Contrast Rule.** Dado que `#0081cf`, `#0089ba`, `#008e9b` y `#008f7a` miden `3.9:1–4.16:1` contra `#ffffff`, solo `#2c73d2` (`4.68:1`) porta texto blanco sólido en botones/enlaces pequeños; los otros 4 tonos emplean tinta `#0f172a` sobre tinte suave `/12` o tinta `#020617` sobre sólido `#008f7a` (`5.02:1`).

## Typography

**Display Font:** JetBrains Mono (fallback monospace del sistema)
**Body Font:** IBM Plex Sans (fallback sans-serif del sistema)
**Label/Mono Font:** JetBrains Mono (400, 600, 700, 800)

**Character:** Emparejamiento técnico de lectura hospitalaria: IBM Plex Sans aporta trazos abiertos en formularios bajo presión, mientras JetBrains Mono fija en rejilla tabular códigos de turno, documentos y cronómetros en vivo sin saltos horizontales.

### Hierarchy
- **Display** (800, `clamp(2.25rem, 6vw, 6rem)`, `line-height: 1`, `letter-spacing: -0.02em`): Códigos gigantes de turno llamado y destino en la pantalla de sala pública.
- **Headline** (700, `clamp(1.65rem, 2.1vw, 2.1rem)`, `line-height: 1.12`, `letter-spacing: -0.035em`): Título `H1` principal de cada vista en `PageHeader` con `text-wrap: balance`.
- **Title** (700, `1.125rem`–`1.25rem`, `line-height: 1.25`, `letter-spacing: -0.02em`): Encabezados de tarjeta, nombre del cubículo activo en ventanilla y títulos de diálogos modales.
- **Body** (400/500, `0.8125rem`–`0.875rem`, `line-height: 1.55`, measure máxima `68ch`): Copys de formularios, descripciones de ayuda clínica y listas de auditoría con `text-wrap: pretty`.
- **Label** (700, `0.6875rem`–`0.75rem`, `line-height: 1.2`, `letter-spacing: 0.08em`): Eyebrows de sección, insignias de prioridad, cabeceras de tabla y etiquetas de formulario.

### Named Rules
**The Tabular Lock Rule.** Todo código de turno (`TUR-000042`), duración transcurrida (`04:18`), cumplimiento porcentual y conteo de cola declara `tabular-nums` en fuente monoespaciada.

**The 11px Legibility Floor.** Ningún rótulo operativo, insignia, atajo `<kbd>` o cifra auxiliar desciende de `11px` (`0.6875rem`).

## Layout

El shell privado implementa una rejilla CSS de dos columnas (`var(--sidebar-width): 264px` expandida / `var(--sidebar-collapsed-width): 78px` colapsada) bajo una cabecera fija de `var(--navbar-height): 68px`. El contenido principal vive centrado hasta `1560px` (`--content-max-width`) con relleno generoso (`32px 36px 40px` en escritorio, `20px 16px 28px` en móvil `< 768px`).

- **Admisión / Recepción (`/recepcion`):** rejilla `12` columnas (`5` formulario táctil/pistola USB + `7` confirmación de último turno y máx. 3 últimos registros Zero-PII).
- **Ventanilla (`/cajero`):** rejilla `.cashier-workspace-grid` de columna única bajo `1280px` y dividida `minmax(0, 1fr) 340px` desde `1280px`.
- **Torre de Control (`/admin`):** split `8/4` sobre grilla de cubículos con conmutador explícito entre densidad estándar (`1–2` columnas) y densidad **Mega-Centro** compacta (`2–4` columnas).
- **Pantalla Pública (`/pantalla`):** split oscuro `8/4` en `#020617` / `#0f172a` sin navegación lateral, optimizada para 16:9.

## Elevation & Depth

El sistema es plano por defecto y construye profundidad mediante contraste de planos tonales (`#f1f5f9` base vs `#ffffff` superficie vs `#f8fafc` bloques empotrados) separados por filetes de `1px` (`#e2e8f0`).

Las sombras se restringen estrictamente a señalizar fijación de cabecera (`0 1px 0 rgb(15 23 42 / 3%)`), separación mínima de tarjetas (`0 1px 3px rgb(0 0 0 / 0.06)`) y resplandor ambiental controlado en el héroe activo de `/pantalla` (`0 0 60px -15px rgba(0, 143, 122, 0.28)` / `0 0 80px -10px rgba(0, 143, 122, 0.45)` al anunciar un llamado).

### Named Rules
**The Hairline-Over-Drop-Shadow Rule.** Las tarjetas en reposo se separan del fondo mediante borde sólido de `1px` y contraste tonal `#f1f5f9`/`#ffffff`.

## Shapes

Cubiora adopta `radius="medium"` en Radix Themes con radios funcionales:
- **4px (`sm`):** botones secundarios compactos, teclas `<kbd>`, insignias de tabla e inputs de diálogo.
- **8px (`md`):** botones primarios de acción transaccional (`Llamar turno`, `Iniciar atención`, `Cerrar turno`), teclado táctil de quiosco y controles de diálogo.
- **10px (`lg`):** ítems de navegación lateral (complementados con barra vertical izquierda de `3px` en `#2c73d2`) y tarjeta de resumen operativo del sidebar.
- **12px–16px (`xl`–`2xl`):** tarjetas operativas, bloques KPI, formularios de admisión, tabla de auditoría y panel completo de `Mi cubículo`.
- **24px (hall surface):** contenedor hero de llamado y panel de recientes en `/pantalla`.
- **999px (`full`):** píldoras de conectividad, sede primaria activa y puntos indicadores.

## Components

### Buttons
Acciones claras con altura táctil mínima de `40px` en secundarios/diálogos y `44px` en acciones primarias y controles táctiles móviles.
- **Primary (`#2c73d2`):** fondo `#2c73d2`, texto `#ffffff`, negrita (`font-weight: 700`), `padding: 12px 24px`, transición `120ms` con hover `inset 0 0 0 100vmax rgb(2 6 23 / 0.14)`.
- **Secondary / Danger:** superficie `#ffffff` con borde `#64748b` y tinta `#0f172a`; variantes destructivas (`No presentado`, `Desactivar`, `Eliminar`) emplean rojo clínico `#b42318` / `#991b1b` reservado exclusivamente a acciones destructivas.
- **Focus:** `outline: 2px solid #2c73d2` con `outline-offset: 2px` en todo botón, enlace y control interactivo.

### Chips
Píldoras de estado e insignias de lectura rápida en `11px`–`12px` negrita.
- **Style:** superficie suave por opacidad (`12%` sobre blanco con tinta `#0f172a` y borde `1px` en el hex exacto de marca: `#2c73d2`, `#0081cf`, `#0089ba`, `#008e9b`, `#008f7a`; o sólido `#008f7a` con tinta `#020617` en insignias prioritarias como `SEDE EN USO`), además de excepciones clínicas Ámbar (`Pendiente 48h` / `ON_LEAVE`) y Rojo (`Sin conexión` / `ABANDONADO`).
- **State:** incluyen punto sólido indicador de 6px en badges de conectividad y permanecen estáticos bajo `prefers-reduced-motion: reduce`.

### Cards / Containers
- **Corner Style:** `12px` en tarjetas operativas y de supervisión; `16px` en tarjetas de configuración y tabla de auditoría.
- **Background:** blanco `#ffffff` con bloques interiores de parametrización en `#f8fafc`.
- **Shadow Strategy:** planas por defecto con borde `1px solid #e2e8f0`; cubículos en `SLA_EXCEDIDO` refuerzan el perímetro mediante borde rojo clínico.

### Inputs / Fields
- **Style:** superficie `#ffffff`, borde sólido `#64748b`, placeholder en `#475569`–`#64748b` y tipografía monoespaciada en campos de códigos/fórmulas/teléfonos.
- **Focus:** anillo `2px` en `#2c73d2` con desplazamiento de `1px`–`2px`.

### Navigation
Barra superior fija de `68px` con acceso rápido de marca, píldora de sede primaria activa (en `>= 1200px` para `ADMIN`), reloj en vivo `es-CO` e indicador de conectividad central; barra lateral fija colapsable (o drawer modal bajo `768px`) filtrada por rol (`RECEPTION`, `CASHIER`, `ADMIN`). La ruta activa resalta con fondo `rgb(44 115 210 / 0.1)`, borde `#2c73d2`, texto `#0f172a` e indicador izquierdo de `3px` en `#2c73d2`. Todos los íconos provienen de `lucide-react`.

### Signature Component: `MiCubiculo`
Estación transaccional de ventanilla gobernada por máquina de estados de 17 pasos sincronizada contra backend (`INITIAL_LOADING` -> `AVAILABLE` -> `ASSIGNED` -> `CALLED` -> `IN_SERVICE` -> `CONFIRM_CLOSE` / `CONFIRM_NO_SHOW`), bloqueando reintentos tras fallos de red mediante `UNCERTAIN_RESULT` y `OFFLINE`.

## Do's and Don'ts

### Do:
- **Do** usar exclusivamente `@radix-ui/themes` (`accentColor="blue"` sobrescrito en `index.css`) y `lucide-react` con los 5 hexes obligatorios (`#2c73d2`, `#0081cf`, `#0089ba`, `#008e9b`, `#008f7a`), neutros Slate y tipografía `IBM Plex Sans` + `JetBrains Mono`.
- **Do** mantener un piso tipográfico mínimo de `11px` y objetivos táctiles >= `44px` en acciones primarias y quiosco.
- **Do** marcar todo valor temporal, métrica o identificador de turno con `tabular-nums`.
- **Do** preservar `prefers-reduced-motion: reduce` y Cero PII en `/pantalla` y en la tabla de últimos turnos de `/recepcion`.

### Don't:
- **Don't** introducir otro color o hex derivado fuera de los 5 hexes oficiales, escala Slate y Rojo/Ámbar clínicos.
- **Don't** emplear `glassmorphism`, `backdrop-blur`, `neumorphism`, sombras decorativas pesadas, bordes izquierdos decorativos (`border-l-4`) ni degradados ornamentales.
- **Don't** mostrar códigos técnicos internos (`SCR-*`), textos de piloto (*Audifarma*) ni formatos regionales ajenos a Colombia (`+54`, `CABA`, `hs`).
- **Don't** habilitar reintentos automáticos si la sincronización con backend se encuentra en `OFFLINE` o `UNCERTAIN_RESULT`.
