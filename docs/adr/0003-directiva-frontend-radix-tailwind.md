# ADR 0003: Estandarización de Frontend en Radix UI Themes y Tailwind CSS v4 (Ajustes PMV)

## Estado
Aprobado con Ajustes

## Contexto
En las primeras iteraciones de Cubiora existía disparidad en la definición de estilos en el cliente web (`apps/web`), combinando estilos en línea (`style={{...}}`), hojas de estilos globales con clases CSS decorativas ad-hoc (`.glass-panel`, `.ticket-hero`, `@keyframes pulse-glow`) y paletas manuales.

Para construir un Producto Mínimo Viable (PMV) operacional de entrega de medicamentos, se definió la necesidad de unificar la base tecnológica en Radix UI Themes y Tailwind CSS v4, pero evitando la sobreingeniería de arquitecturas sobredimensionadas como Atomic Design completo o abstracciones preventivas que resten velocidad de entrega.

## Decisión
Se establece como directiva oficial y exclusiva para el frontend de Cubiora:

1. **Stack Técnico Obligatorio**:
   - **React 19+**
   - **Tailwind CSS v4** (`@tailwindcss/vite` + `@import "tailwindcss";`)
   - **Radix UI Themes** (`@radix-ui/themes` + `@import "@radix-ui/themes/styles.css";`) y **Radix UI Primitives**
   - **React Hook Form** + **Zod** (`@hookform/resolvers/zod`)
   - **TanStack Query** (`@tanstack/react-query`)

2. **Ajustes de Simplicidad PMV**:
   - **Rechazo de Atomic Design Completo**: Se descarta `atoms/`, `molecules/`, etc. Se adopta la estructura pragmática:
     `src/app/`, `src/pages/`, `src/features/`, `src/components/{ui,forms,layout,shared}`, `src/lib/`, `src/hooks/`, `src/services/`, `src/types/`.
   - **Radix como Primera Opción**: Se prohíbe crear wrappers preventivos. Se usan los componentes oficiales directamente (`Button`, `Card`, `TextField`, `Select`, `Badge`, `Callout`, etc.).
   - **Prohibición de Diseño Decorativo**: Queda estrictamente prohibido el uso de glassmorphism, sombras excesivas, gradientes complejos, efectos decorativos o animaciones no operacionales. Se prioriza la legibilidad clínica, velocidad operativa, contraste y accesibilidad WCAG AA.

3. **Formularios y Accesibilidad**:
   - Todo formulario valida mediante schemas Zod centralizados.
   - Todo control interactivo garantiza foco visible, navegación por teclado y contraste conforme a WCAG AA.
   - La pantalla pública mantiene garantía estricta de cero PII.

## Consecuencias
- **Positivas**:
  - 100% adherencia a Radix Themes y Tailwind v4.
  - Cero librerías redundantes (0 MUI, 0 AntD, 0 Chakra, 0 Bootstrap).
  - Reducción drástica de `index.css` de 242 líneas de clases ad-hoc a 2 líneas de imports oficiales más base mínima tipográfica.
  - Arquitectura simple, desacoplada y directamente orientada al valor del producto para el PMV.
