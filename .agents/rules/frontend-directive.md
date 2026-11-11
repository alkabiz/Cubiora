# DIRECTIVA OFICIAL DE FRONTEND CUBIORA (PMV v1.0)

Este documento define la regla de arquitectura, diseño y desarrollo frontend obligatoria para todo el proyecto Cubiora.

## 1. Stack Obligatorio
- **React** (v19+)
- **Tailwind CSS v4** (`@tailwindcss/vite` + `@import "tailwindcss";`)
- **Radix UI Themes** (`@radix-ui/themes` + `@import "@radix-ui/themes/styles.css";`)
- **Radix UI Primitives** (`@radix-ui/react-*`)
- **React Hook Form** + **Zod** (`@hookform/resolvers/zod`)
- **TanStack Query** (`@tanstack/react-query`)

### Prohibiciones Absolutas (Cero Tolerancia)
Queda estrictamente prohibido el uso de:
- Material UI, Ant Design, Mantine, Chakra UI, NextUI, Bootstrap, Semantic UI, PrimeReact, DaisyUI, Headless UI, Flowbite.
- Componentes custom innecesarios (si la funcionalidad existe en Radix UI, debe usarse Radix UI).
- CSS Modules extensos, Styled Components, Emotion o estilos inline arbitrarios.
- Redux o gestores complejos redundantes.

---

## 2. Objetivo del Sistema: Simplicidad PMV Operacional
Cubiora construye un Producto Mínimo Viable (PMV) para dispensación y atención médica:
- **Simplicidad > Sofisticación**.
- **Menos arquitectura. Más producto.**
- Prohibición estricta de diseño decorativo:
  - Cero Glassmorphism, Neumorphism, sombras excesivas, gradientes complejos, efectos decorativos o animaciones no funcionales.
  - Priorizar: legibilidad, accesibilidad WCAG AA, velocidad operativa, claridad visual y bajo esfuerzo cognitivo.
- Regla de evaluación: *"¿Esto ayuda a lanzar el PMV más rápido y con menos complejidad?"*. Si la respuesta es no, posponer o eliminar.

---

## 3. Estructura Aprobada para PMV (Sin Atomic Design Completo)
Se descarta la sobreingeniería de Atomic Design completo. La estructura obligatoria es:

```
src/
├── app/                     (layout.tsx, providers.tsx, router.tsx)
├── pages/                   (reception-page.tsx, cashier-page.tsx, display-page.tsx, login-page.tsx)
├── features/                (lógica específica de dominio, queries, handlers)
├── components/
│   ├── ui/                  (componentes comunes confirmados sin wrappers preventivos)
│   ├── forms/               (schemas y campos reutilizables)
│   ├── layout/              (elementos estructurales)
│   └── shared/              (componentes transversales)
├── lib/                     (api.ts, query-client.ts, sse-client.ts)
├── hooks/                   (hooks reactivos)
├── services/                (llamadas al backend)
└── types/                   (definiciones TypeScript específicas)
```

---

## 4. Radix como Primera Opción (Sin Wrappers Preventivos)
- Siempre utilizar primero los componentes oficiales de Radix Themes (`Button`, `Card`, `TextField`, `Select`, `Badge`, `Dialog`, `Callout`, `Tabs`).
- Solo crear componentes propios ante necesidad funcional real, reutilización comprobada o estandarización obligatoria.
- Cero abstracciones preventivas.

---

## 5. Tokens de Diseño y Accesibilidad
- **Fuente única de verdad visual**: Radix Themes `<Theme accentColor="blue" grayColor="slate" radius="medium">` con tokens CSS de marca definidos en `src/styles/index.css` y `src/styles/app-shell.css`.
- **Colores obligatorios de marca**: Exclusivamente `#2c73d2` (primario Cobalto / foco), `#0081cf` (activo Cerúleo), `#0089ba` (informativo), `#008e9b` (llamado / progreso) y `#008f7a` (confirmación / hall), combinados únicamente con neutros Slate (`#f1f5f9`, `#ffffff`, `#f8fafc`, `#e2e8f0`, `#64748b`, `#475569`, `#0f172a`, `#020617`) y Rojo/Ámbar clínicos restringidos a errores, acciones destructivas y alertas. Prohibida cualquier referencia a otro color de marca o acento.
- **Espaciado**: Escala estándar de Tailwind (`p-1`, `p-2`, `p-4`, `p-6`, `p-8`).
- **Responsive**: Mobile-First mandatorio (Mobile, Tablet, Desktop).
- **Accesibilidad**: Cumplimiento WCAG AA (contraste, foco visible, navegación teclado, aria-labels, aria-live).
- **Privacidad**: Cero exposición de PII en pantallas públicas.

---

## 6. Formularios y Datos
- **Formularios**: `react-hook-form` + `zod` con `@hookform/resolvers/zod`. Toda validación debe realizarse mediante schemas.
- **Gestión de Estado**: Local > Context > Zustand (solo si es necesario).
- **Carga de Datos**: Centralizado mediante `TanStack Query`. Prohibidos `fetch` dispersos.
- **UX PMV**: Resolver la tarea principal con la menor cantidad de clics.
