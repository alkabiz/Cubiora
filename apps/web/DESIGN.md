---
name: Cubiora
description: Sistema de diseño clínico-operativo de alta legibilidad para gestión de turnos, ventanillas farmacéuticas y pantallas de sala en Colombia.
colors:
  clinical-teal: "#0f766e"
  clinical-teal-hover: "#115e59"
  clinical-teal-deep: "#134e4a"
  mint-wash: "#f0fdfa"
  mint-tint: "#ccfbf1"
  ink-navy: "#0f2942"
  ink-navy-hover: "#0a1b2c"
  slate-muted: "#475569"
  slate-control-border: "#64748b"
  canvas-cool: "#f3f6fa"
  surface-white: "#ffffff"
  surface-subtle: "#f8fafc"
  hairline-border: "#dbe4ee"
  status-success: "#047857"
  status-warning: "#92400e"
  status-danger: "#b42318"
  hall-abyss: "#020b14"
  hall-surface: "#041527"
  hall-emerald: "#34d399"
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
    backgroundColor: "{colors.ink-navy}"
    textColor: "{colors.surface-white}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.ink-navy-hover}"
  button-accent:
    backgroundColor: "{colors.clinical-teal}"
    textColor: "{colors.surface-white}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
    height: "44px"
  button-accent-hover:
    backgroundColor: "{colors.clinical-teal-hover}"
  button-secondary:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink-navy}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
    height: "40px"
  card-surface:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.xl}"
    padding: "20px"
  input-control:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink-navy}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
  nav-link-active:
    backgroundColor: "{colors.mint-wash}"
    textColor: "{colors.clinical-teal-hover}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "10px 12px"
    height: "44px"
  status-badge-online:
    backgroundColor: "{colors.mint-tint}"
    textColor: "{colors.clinical-teal-deep}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "3px 9px"
---

# Design System: Cubiora

## Overview

**Creative North Star: "The Clinical Precision Bench"**

Cubiora está diseñado como un banco de instrumentación clínica: sereno, estructurado y de lectura instantánea bajo presión operativa. Cada estación —desde un quiosco táctil de admisión hasta un cubículo con 20+ puestos simultáneos o un televisor de sala a tres metros— privilegia la jerarquía tipográfica clara, superficies planas delimitadas por líneas nítidas y confirmaciones gobernadas por el servidor.

El sistema combina la sobriedad institucional de Radix Themes (`accentColor="teal"`, `grayColor="slate"`, `radius="medium"`) con tipografía autoalojada para operar en redes hospitalarias aisladas y entornos detrás de Cloudflare Tunnel sin depender de fuentes externas. Rechaza de raíz cualquier ornamento que compita con la seguridad farmacéutica: cero glassmorphism, cero neumorphism, cero gradientes decorativos y cero exposición pública de datos personales (Ley 1581 de 2012).

**Key Characteristics:**
- Paleta clínico-institucional única en Teal (`#0f766e`) y Azul Tinta (`#0f2942`) sobre lienzo frío `#f3f6fa`.
- Dúo tipográfico técnico autoalojado: **IBM Plex Sans** para UI y flujos clínicos y **JetBrains Mono** tabular para códigos de turno y cronómetros.
- Superficies planas estructuradas mediante bordes de 1px y contraste verificable WCAG 2.2 Nivel AA en modo claro operativo y pantalla oscura 10-foot UI.
- Estados interactivos disciplinados que bloquean reintentos ambiguos y comunican pérdida de conectividad sin relleno visual.

## Colors

La paleta operativa articula un único acento clínico en verde-azulado profundo respaldado por neutros fríos de alto contraste y un modo oscuro dedicado exclusivamente al monitor público de sala.

### Primary
- **Clinical Teal** (`#0f766e`): Acento maestro (`--app-primary`) para acciones principales de admisión y configuración, anillo de foco teclado WCAG 2.4.7 (`#0f766e`), barra lateral activa y botones de reactivación operativa.
- **Clinical Teal Hover** (`#115e59`): Estado activo y hover del acento (`--app-primary-hover`), texto del enlace de navegación seleccionado y relleno del avatar institucional de usuario.
- **Clinical Teal Deep** (`#134e4a`): Tinta de contraste AAA para la insignia de contexto de rol dentro de la barra superior.
- **Mint Wash** (`#f0fdfa`): Fondo suave (`--app-primary-soft`) para ítems de navegación activos y marcadores de estado vacío sin peso visual.
- **Mint Tint** (`#ccfbf1`): Resaltado de selección de texto (`--app-primary-soft-strong`) y fondo de la píldora de contexto de rol.

### Neutral
- **Ink Navy** (`#0f2942`): Tinta estructural (`--app-text`) para encabezados principales, códigos de turno en ventanilla y botones de avance transaccional primario (`Llamar turno`, `Cerrar turno`).
- **Ink Navy Hover** (`#0a1b2c`): Tono presionado y hover de acciones primarias oscuras de alto impacto.
- **Slate Muted** (`#475569`): Tinta secundaria (`--app-text-muted`) para descripciones, metadatos de cubículo y etiquetas de métricas con contraste >= 4.5:1 sobre blanco y `#f8fafc`.
- **Slate Control Border** (`#64748b`): Borde de controles interactivos y entradas (`--app-border-strong`) calibrado para superar el mínimo >= 3.0:1 de WCAG 1.4.11 en UI no textual.
- **Cool Canvas** (`#f3f6fa`): Lienzo base de la aplicación privada (`--app-bg`) que separa sutilmente las tarjetas clínicas de primer plano.
- **Surface White** (`#ffffff`): Contenedor primario (`--app-surface`) para tarjetas operativas, tablas de auditoría, barra superior y barra lateral.
- **Surface Subtle** (`#f8fafc`): Superficie empotrada (`--app-surface-subtle`) para cabeceras fijas de tabla, bloques internos de parametrización y tarjetas de resumen en barra lateral.
- **Hairline Border** (`#dbe4ee`): Divisor estructural de 1px (`--app-border`) que sustituye sombras pesadas entre secciones.
- **Semantic Status Tones** (`#047857`, `#92400e`, `#b42318`): Estados normativos restringidos a confirmación SLA (`--app-success`), alerta preventiva de cuello de botella / pendiente 48h (`--app-warning`) y error o desvío crítico (`--app-danger`).
- **Public Hall Dark Palette** (`#020b14`, `#041527`, `#34d399`): Uso exclusivo en `/pantalla` (10-foot UI) para maximizar la legibilidad a distancia en salas de espera iluminadas sin deslumbramiento.

### Named Rules
**The One-Accent Clinical Rule.** El verde clínico (`#0f766e`) y los colores semánticos nunca se usan como decoración masiva de fondo; las tarjetas permanecen blancas y el color señala únicamente acción primaria, selección activa o desviación operativa.

**The Non-Textual Contrast Rule.** Todo campo de texto, selector, botón secundario y botón de paginación debe mantener un borde visible de al menos 3.0:1 (`#64748b`) frente a su superficie para garantizar su percepción en monitores de ventanilla mal calibrados.

## Typography

**Display Font:** JetBrains Mono (fallback monospace del sistema)
**Body Font:** IBM Plex Sans (fallback sans-serif del sistema)
**Label/Mono Font:** JetBrains Mono (400, 600, 700, 800)

**Character:** Un emparejamiento técnico de lectura hospitalaria: IBM Plex Sans aporta trazos abiertos que distinguen caracteres similares en formularios bajo presión, mientras JetBrains Mono fija en rejilla tabular códigos de turno, documentos y cronómetros en vivo sin saltos horizontales.

### Hierarchy
- **Display** (800, `clamp(2.25rem, 6vw, 6rem)`, `line-height: 1`, `letter-spacing: -0.02em`): Códigos gigantes de turno llamado y destino en la pantalla de sala pública.
- **Headline** (700, `clamp(1.65rem, 2.1vw, 2.1rem)`, `line-height: 1.12`, `letter-spacing: -0.035em`): Título `H1` principal de cada vista en `PageHeader` con `text-wrap: balance`.
- **Title** (700, `1.125rem`–`1.25rem`, `line-height: 1.25`, `letter-spacing: -0.02em`): Encabezados de tarjeta, nombre del cubículo activo en ventanilla y títulos de diálogos modales.
- **Body** (400/500, `0.8125rem`–`0.875rem`, `line-height: 1.55`, measure máxima `68ch`): Copys de formularios, descripciones de ayuda clínica y listas de auditoría con `text-wrap: pretty`.
- **Label** (700, `0.6875rem`–`0.75rem`, `line-height: 1.2`, `letter-spacing: 0.08em`, mayúsculas en rótulos de sección): Eyebrows de sección, insignias de prioridad, cabeceras de tabla y etiquetas de formulario.

### Named Rules
**The Tabular Lock Rule.** Todo código de turno (`TUR-000042`), duración transcurrida (`04:18`), cumplimiento porcentual y conteo de cola debe declarar `tabular-nums` en fuente monoespaciada para evitar vibración visual en ticks de 1 segundo.

**The 11px Legibility Floor.** Ningún rótulo operativo, insignia, atajo `<kbd>` o cifra auxiliar puede descender de `11px` (`0.6875rem`); las tablas e interfaces densas emplean `11px`–`12px` como piso duro de legibilidad.

## Layout

El shell privado implementa una rejilla CSS de dos columnas (`var(--sidebar-width): 264px` expandida / `var(--sidebar-collapsed-width): 78px` colapsada) bajo una cabecera fija de `var(--navbar-height): 68px`. El contenido principal vive centrado hasta `1560px` (`--content-max-width`) con relleno generoso (`32px 36px 40px` en escritorio, `20px 16px 28px` en móvil `< 768px`).

En vistas especializadas el layout responde a la ergonomía real del puesto:
- **Admisión / Recepción (`/recepcion`):** rejilla `12` columnas (`5` formulario táctil/pistola USB + `7` confirmación de último turno y máx. 3 últimos registros Zero-PII).
- **Ventanilla (`/cajero`):** rejilla `.cashier-workspace-grid` de columna única bajo `1280px` y dividida `minmax(0, 1fr) 340px` desde `1280px` para mantener visible la tarjeta de rendimiento diario del cubículo.
- **Torre de Control (`/admin`):** split `8/4` sobre grilla de cubículos con conmutador explícito entre densidad estándar (`1–2` columnas) y densidad **Mega-Centro** compacta (`2–4` columnas).
- **Pantalla Pública (`/pantalla`):** split oscuro `8/4` sin navegación lateral ni desplazamiento horizontal oculto, diseñada para relación de aspecto panorámica 16:9.

## Elevation & Depth

El sistema es plano por defecto y construye profundidad mediante contraste de planos tonales (`#f3f6fa` base vs `#ffffff` superficie vs `#f8fafc` bloques empotrados) separados por filetes nítidos de `1px` (`#dbe4ee`). No emplea elevaciones flotantes decorativas ni desenfoques translúcidos.

Las sombras se restringen estrictamente a señalizar fijación de cabecera (`0 1px 0 rgb(15 41 66 / 2%)`), separación mínima de tarjetas interactivas (`0 1px 3px rgb(0 0 0 / 0.06)`) y resplandor ambiental controlado en el héroe activo de `/pantalla` (`0 0 60px -15px rgba(16, 185, 129, 0.2)` / `0 0 80px -10px rgba(16, 185, 129, 0.35)` al anunciar un llamado).

### Named Rules
**The Hairline-Over-Drop-Shadow Rule.** Las tarjetas en reposo se separan del fondo mediante borde sólido de `1px` y contraste tonal `#f3f6fa`/`#ffffff`; queda prohibido apilar sombras difusas múltiples para simular capas de vidrio.

## Shapes

Cubiora adopta un lenguaje geométrico técnico (`radius="medium"` en Radix Themes) con radios discretos y funcionales:
- **4px (`sm`):** botones secundarios compactos, teclas `<kbd>`, insignias de tabla e inputs empotrados de diálogo.
- **8px (`md`):** botones primarios de acción transaccional (`Llamar turno`, `Cerrar turno`), cuadros de confirmación rápida y botones del teclado táctil de quiosco.
- **10px (`lg`):** ítems de navegación lateral (complementados con barra indicadora vertical izquierda de `3px` en estado activo) y tarjeta de resumen operativo del sidebar.
- **12px–16px (`xl`–`2xl`):** tarjetas operativas, bloques KPI, formularios de admisión, tabla de auditoría y panel completo de `Mi cubículo`.
- **24px (hall surface):** contenedor hero de llamado y panel de recientes en la pantalla pública de 10-foot UI.
- **999px (`full`):** píldoras de estado de conexión WebSocket/red, sede primaria activa y puntos indicadores de estado.

## Components

### Buttons
Acciones claras con altura táctil mínima de `40px` en secundarios/diálogos y `44px` en acciones primarias y controles táctiles móviles.
- **Shape:** esquinas medianamente redondeadas (`8px`) en primarios y (`4px`) en secundarios de soporte.
- **Primary (`ink-navy`):** fondo `#0f2942`, texto blanco, negrita (`font-weight: 700`), `padding: 12px 24px`, transición `120ms` hacia `#0a1b2c`; reservado a hitos críticos de flujo (`Llamar turno`, `Cerrar turno`).
- **Primary Accent (`clinical-teal`):** fondo `#0f766e` con hover `#115e59`, usado para iniciar atención, emitir turnos, confirmar creación de sedes/farmacéuticos y guardar configuración.
- **Secondary / Danger:** superficie blanca con borde `#64748b` y tinta `#0f2942`; variantes destructivas (`No presentado`, `Desactivar`, `Eliminar`) emplean tinta roja de alto contraste `#b42318` / `#ba1a1a` sobre fondo neutro o tinte rosado claro sin relleno sólido agresivo salvo confirmación final modal.
- **Focus:** `outline: 2px solid #0f766e` con `outline-offset: 2px` en todo botón, enlace y control interactivo.

### Chips
Píldoras de estado e insignias de lectura rápida en `11px`–`12px` negrita.
- **Style:** tinte pastel de alto contraste con borde fino del mismo rango cromático (por ejemplo `#ccfbf1` / `#134e4a` para rol, `#d1fae5` / `#064e3b` para `En línea`, `#fef3c7` / `#92400e` para `Pendiente 48h` / `Verificando`, `#fee2e2` / `#991b1b` para `Sin conexión`).
- **State:** incluyen punto sólido indicador de 6px en badges de conectividad y permanecen estáticos bajo `prefers-reduced-motion: reduce`.

### Cards / Containers
Superficies de lectura limpia orientadas a escaneo lateral rápido.
- **Corner Style:** `12px` en tarjetas operativas y de supervisión; `16px` en tarjetas de configuración de cubículo y contenedor de tabla de auditoría.
- **Background:** blanco `#ffffff` con bloques interiores de parametrización en `#f8fafc`.
- **Shadow Strategy:** planas por defecto con borde `1px solid #dbe4ee`; los cubículos en `SLA_EXCEDIDO` refuerzan el perímetro mediante borde rojo y anillo `1px` sin depender solo del color.
- **Internal Padding:** `14px`–`20px` en tarjetas densas; `20px`–`32px` en el área principal de ventanilla y formularios de admisión.

### Inputs / Fields
Campos preparados tanto para digitación humana como para escáneres USB emulados (PDF417 y Code128).
- **Style:** superficie `#ffffff`, borde sólido visible `#64748b` (`4px`–`8px` de radio según contexto), placeholder en `#475569`–`#64748b` y tipografía monoespaciada en campos de códigos/fórmulas/teléfonos.
- **Focus:** anillo `2px` en `#0f766e` con desplazamiento de `1px`–`2px`.
- **Error / Disabled:** borde rojo e `aria-invalid="true"` vinculado a mensaje descriptivo inferior y cursor `not-allowed` con opacidad `0.6` durante envío transaccional.

### Navigation
Barra superior fija de `68px` con acceso rápido de marca, píldora de sede primaria activa (en `>= 1200px` para `ADMIN`), reloj en vivo `es-CO` e indicador de conectividad central; acompañada por barra lateral fija colapsable (o drawer modal accesible bajo `768px`) filtrada estrictamente por rol (`RECEPTION`, `CASHIER`, `ADMIN`). La ruta activa resalta con fondo `#f0fdfa`, borde `#99f6e4`, texto `#115e59` e indicador izquierdo de `3px` en `#0f766e`. Todos los íconos provienen exclusivamente de `lucide-react` para uniformidad de trazo (`stroke-width: 2`).

### Signature Component: `MiCubiculo`
Estación transaccional de ventanilla gobernada por una máquina de estados de 17 pasos sincronizada contra backend (`INITIAL_LOADING` -> `AVAILABLE` -> `ASSIGNED` -> `CALLED` -> `IN_SERVICE` -> `CONFIRM_CLOSE` / `CONFIRM_NO_SHOW`). Bloquea acciones optimistas ciegas tras fallos de red pasando a `UNCERTAIN_RESULT` o `OFFLINE` hasta que el operador ejecute una reconciliación explícita de estado.

## Do's and Don'ts

### Do:
- **Do** usar exclusivamente primitivas de `@radix-ui/themes` y `lucide-react` con los tokens definidos (`#0f766e`, `#0f2942`, `IBM Plex Sans`, `JetBrains Mono`) en toda nueva vista o diálogo.
- **Do** mantener un piso tipográfico mínimo de `11px` y objetivos táctiles >= `44px` en acciones primarias y controles móviles/quiosco (y >= `32px` con margen en botones secundarios densos).
- **Do** marcar todo valor temporal, métrica o identificador de turno con tipografía monoespaciada y `tabular-nums`.
- **Do** preservar `prefers-reduced-motion: reduce` comunicando cambios críticos mediante color, borde y texto explícito sin depender de animaciones.
- **Do** garantizar Cero PII (solo código de turno, prioridad y cubículo asignado) en `/pantalla` y en la tabla de últimos turnos de `/recepcion`.

### Don't:
- **Don't** introducir librerías de componentes externas, fuentes remotas (`fonts.googleapis.com`), ni sets de íconos mezclados fuera de `lucide-react`.
- **Don't** emplear `glassmorphism`, `backdrop-blur`, `neumorphism`, sombras decorativas pesadas, bordes izquierdos decorativos (`border-l-4`) ni degradados ornamentales en tarjetas clínicas.
- **Don't** mostrar códigos técnicos internos (`SCR-*`), textos heredados de piloto (`Audifarma`) ni formatos regionales ajenos a Colombia (`+54`, `CABA`, `hs`).
- **Don't** habilitar reintentos automáticos o botones de cierre si la sincronización con backend se encuentra en estado `OFFLINE` o `UNCERTAIN_RESULT`.
