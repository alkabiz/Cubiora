# Shell de aplicación — Cubiora

Implementación del shell responsive que envuelve las pantallas privadas aprobadas:
navbar superior, sidebar por rol, contenedor principal, encabezado de página y
comportamiento móvil con Radix UI / Radix Themes.

---

## 1. Diagnóstico del layout anterior

Antes de este cambio:

- `Layout` sólo aportaba `AuthProvider` y un `<main>` genérico; no existía un
  shell persistente.
- Recepción y Mi cubículo repetían marca, usuario, estado de conexión y cierre
  de sesión dentro de cada página.
- No existía navegación lateral ni navegación derivada del rol. El rol
  `ADMIN` terminaba en `/recepcion`.
- El cierre de sesión de Mi cubículo vivía dentro de la página y dependía de su
  estado local.
- `/pantalla` compartía el árbol de `Layout`, sin una separación explícita de
  layout público.
- Cada pantalla definía su propio ancho, padding y jerarquía de encabezado.

El shell corrige esos puntos sin tocar la lógica de turnos, los endpoints, la
persistencia, los contratos de API, la máquina de estados, las transacciones ni
la integración SSE.

---

## 2. Arquitectura

```text
AppShell
├── ShellStatusProvider
├── AppNavbar
│   ├── marca + contexto de rol
│   ├── estado de conexión + NavbarClock
│   └── avatar + menú de usuario + cierre de sesión
├── AppSidebar (escritorio / tableta)
│   ├── SidebarBrand
│   ├── SidebarNavigation
│   └── SidebarFooter
├── Outlet → pantalla privada
│   └── AppMain
│       ├── PageHeader
│       └── PageContent
├── Dialog de navegación móvil
└── Dialog de cierre de sesión bloqueado
```

### Archivos

| Archivo | Responsabilidad |
| :--- | :--- |
| `apps/web/src/app/app-shell.tsx` | Composición del shell, Drawer móvil, cierre de sesión y escucha de conexión del navegador. |
| `apps/web/src/app/app-navbar.tsx` | Marca, contexto, conexión, reloj, avatar y menú de usuario. |
| `apps/web/src/app/app-sidebar.tsx` | Navegación por rol, estados expandido/colapsado/móvil, tooltips y footer. |
| `apps/web/src/app/app-main.tsx` | Landmark principal, contenedor y contenido de página. |
| `apps/web/src/app/page-header.tsx` | Encabezado uniforme con código, sección, título, descripción y acción opcional. |
| `apps/web/src/app/navbar-clock.tsx` | Reloj local aislado y memoizado. |
| `apps/web/src/app/navigation-config.ts` | Configuración tipada de roles, rutas, etiquetas e iconos. |
| `apps/web/src/app/shell-status-context.tsx` | Estado de conexión y bloqueo de cierre de sesión compartido con las páginas. |
| `apps/web/src/app/public-display-layout.tsx` | Layout independiente para `/pantalla`. |
| `apps/web/src/app/router.tsx` | Separación de rutas privadas, login y pantalla pública. |
| `apps/web/src/styles/app-shell.css` | Tokens semánticos, grid, navbar, sidebar, Drawer, PageHeader y breakpoints. |

No se agregaron dependencias. Se usan Radix Themes y `@radix-ui/react-icons`
ya presentes en el proyecto.

---

## 3. Navegación por rol

La navegación se deriva del usuario autenticado y se filtra en el frontend para
la experiencia de uso. La autorización efectiva sigue dependiendo del backend y
de las rutas protegidas.

| Rol | Navegación visible | Ruta inicial |
| :--- | :--- | :--- |
| `RECEPTION` | Generar turno | `/recepcion` |
| `CASHIER` | Mi cubículo | `/cajero` |
| `ADMIN` | Cubículos, Historial | `/admin/cubiculos` |

- Generar turno usa `SCR-REC-001 · Recepción`.
- Mi cubículo usa `SCR-CAJ-001 · Operación`.
- Cubículos usa `SCR-ADM-002 · Administración`.
- Historial usa `SCR-ADM-003 · Auditoría básica`.

Los módulos administrativos existen únicamente como destinos honestos de
navegación y muestran un estado de módulo pendiente. No consultan endpoints
nuevos, no inventan métricas y no incorporan datos ficticios. La gestión
administrativa real queda fuera del alcance de esta entrega.

---

## 4. Responsive

| Rango | Comportamiento |
| :--- | :--- |
| `>= 1200 px` | Navbar completa, sidebar expandida de 264 px, nombre y rol visibles, reloj visible, padding amplio. |
| `768–1199 px` | Sidebar colapsable con iconos y tooltips, usuario compacto, reloj oculto, contenido con padding reducido. |
| `< 768 px` | Sidebar persistente oculta; botón de menú; Drawer Radix con focus trap; navbar compacta; padding de 16 px; una columna. |

La captura y validación se realizaron en `1440`, `1024`, `768` y `390 px`. En
todos los casos `document.documentElement.scrollWidth` fue igual al viewport:
sin scroll horizontal.

El reloj se actualiza únicamente dentro de `NavbarClock`; no provoca
re-renderizaciones del árbol completo.

---

## 5. Accesibilidad

- Enlace “Saltar al contenido principal” visible al recibir foco.
- Landmark `main#main-content` con `tabIndex={-1}`.
- `<nav aria-label="Navegación principal">` en escritorio y
  “Navegación principal móvil” dentro del Drawer.
- `aria-current="page"` en el elemento activo.
- En sidebar colapsada se conserva el nombre accesible y se ofrece tooltip
  visual; no existen botones de sólo icono sin nombre.
- Foco visible en marca, enlaces, botones, menú de usuario y acciones del shell.
- DropdownMenu de Radix para el menú de usuario.
- Dialog de Radix para el Drawer móvil, con focus trap, cierre con Escape y
  retorno de foco.
- El estado de conexión no depende sólo del color: incluye texto
  “En línea”, “Sin conexión” o “Verificando”.
- El cierre de sesión bloqueado usa un diálogo con título, descripción y una
  única acción segura “Volver al turno”.

---

## 6. Estado de conexión y cierre de sesión

`Mi cubículo` publica en `ShellStatusContext` los datos que ya produce su
integración real:

- `workspace.isOnline` → `En línea` / `Sin conexión`.
- `workspace.isInitialLoading` → `Verificando`.
- Turno en `ASSIGNED`, `CALLED` o `IN_SERVICE` → `logoutBlocked = true`.

El shell consume ese estado para el badge y para bloquear el cierre de sesión.
No se creó un segundo sistema de reconexión ni se modificó la lógica de turnos.
En rutas distintas de Mi cubículo, el badge refleja los eventos `online` /
`offline` del navegador.

Al cerrar sesión sin turno activo, el shell ejecuta el logout existente y
redirige a `/login`. Con turno activo, muestra el diálogo “Turno activo en
progreso” y no ejecuta el logout.

---

## 7. Pantalla pública

`/pantalla` queda fuera de `AppShell` y se monta bajo `PublicDisplayLayout`.
No renderiza navbar de operadores, sidebar, avatar, menú de usuario ni
navegación privada. Conserva su layout de monitor y su integración SSE sin
cambios.

La prueba de integración verifica que `/pantalla` no contiene la navegación
principal ni el menú de usuario del shell.

---

## 8. Verificación

| Comprobación | Resultado |
| :--- | :--- |
| `pnpm --filter web test` | 58 pruebas aprobadas en 4 archivos. |
| `pnpm --filter web lint` | Sin errores. |
| `pnpm typecheck` | Sin errores (`tsc -b` en web). |
| `pnpm build` | Shared, API y web compilados correctamente. |

### Bundle

Comparación contra el build anterior de `apps/web`:

| Recurso | Antes | Después | Delta |
| :--- | ---: | ---: | ---: |
| JavaScript total | 590.81 KiB / 183.48 KiB gzip | 675.27 KiB / 207.09 KiB gzip | +84.46 KiB / +23.62 KiB gzip |
| CSS total | 690.85 KiB / 84.79 KiB gzip | 700.69 KiB / 87.12 KiB gzip | +9.84 KiB / +2.32 KiB gzip |

El incremento corresponde al shell completo (navbar, sidebar, Drawer, menú de
usuario, diálogo de bloqueo, PageHeader, reloj e iconos) y a la separación de
las rutas privadas. Las pantallas siguen en chunks independientes y `/pantalla`
conserva un chunk propio de 5.37 KiB. No se agregaron librerías de animación,
gráficos ni paquetes de iconos completos.

### Capturas

En `docs/screenshots/layout/`:

1. `01-recepcion-escritorio-1440.png`
2. `02-mi-cubículo-escritorio-1440.png`
3. `03-admin-cubiculos-escritorio-1440.png`
4. `04-sidebar-colapsada-1440.png`
5. `05-tableta-1024.png`
6. `06-tableta-768.png`
7. `07-movil-cerrado-390.png`
8. `08-movil-abierto-390.png`
9. `09-pantalla-publica-1440.png`
10. `10-admin-historial-escritorio-1440.png`

---

## 9. Riesgos y pendientes

- Los módulos reales de Cubículos e Historial no están implementados en el PMV.
  Las páginas actuales son destinos de navegación con estado pendiente; no
  agregan datos, endpoints ni métricas.
- El estado de conexión de Recepción se basa en los eventos del navegador. La
  fuente operativa detallada de Mi cubículo sigue siendo la integración real de
  su snapshot.
- La sidebar no persiste el estado colapsado entre recargas; se mantiene como
  preferencia de sesión de UI.
- El cierre de sesión global se apoya en el estado reportado por Mi cubículo.
  Si en el futuro otra pantalla incorpora turnos activos, deberá publicar su
  propio `logoutBlocked` en el mismo contexto.
