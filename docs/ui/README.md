# Matrices de Interfaz Aprobadas — Cubiora (PMV v1.0)

Este directorio contiene única y exclusivamente la especificación y matrices de las interfaces oficiales aprobadas para el sistema Cubiora. Cualquier componente fuera de estas matrices ha sido trasladado a `docs/archive/rejected-prototypes/`.

---

## 1. Matriz de Pantallas Aprobadas

| Identificador | Ruta Web | Perfil / Rol | Contrato Visual | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| **SCR-REC-001** | `/recepcion` | `RECEPTIONIST` | Recepción | Emisión ágil de turnos. Muestra últimos 3 turnos (Turno, Hora, Cubículo, Estado) con **Cero PII**. Notificación y copia de código. |
| **SCR-CAJ-001** | `/cajero` | `CASHIER` | Mi Cubículo | Operación de cubículo exclusivo. Comandos atómicos (`call`, `start-service`, `close`, `no-show`) con `expected-version`, `Idempotency-Key` y `X-Correlation-ID`. |
| **SCR-PUB-001** | `/pantalla` | Público (Sin auth) | Sala de Espera | Visualización pública de llamados en tiempo real vía SSE. Turno llamado principal, últimos llamados, control de audio accesible y **estricto Cero PII** (sin nombres ni documentos). |

---

## 2. Contratos y Estados por Pantalla

### 2.1 Recepción (`SCR-REC-001`)
- **Estados de Ticket Visualizados**:
  - `ASSIGNED`: Badge "Asignado", texto "Cubículo asignado", texto "Observe la pantalla de llamados" (no expone número específico).
  - `CALLED`: Badge "Llamado", texto "Diríjase al Cubículo XX".
- **Últimos turnos generados**:
  - Máximo 3 registros ordenados descendentemente.
  - Columnas: Turno (`publicCode`), Hora (`timeStr`), Cubículo (`assignedCubicle`), Estado (`state`).
  - **Exclusión obligatoria**: Cero datos personales del paciente (`patientName`, `patientDocument`).
- **Acciones**:
  - Emisión de turno con tecla Enter o botón "Generar Turno".
  - Copiar número de turno con feedback accesible "Número de turno copiado".

### 2.2 Mi Cubículo (`SCR-CAJ-001`)
- **Bloqueo de Cierre**: Botón "Finalizar y Cerrar Turno" inhabilitado hasta que el turno esté en estado `IN_SERVICE`.
- **Transición Controlada**:
  - `AVAILABLE` $\rightarrow$ Botón "Llamar turno siguiente"
  - `ASSIGNED` $\rightarrow$ Botón "Llamar turno"
  - `CALLED` $\rightarrow$ Botones "Iniciar atención", "Repetir llamado", "Paciente no presentado"
  - `IN_SERVICE` $\rightarrow$ Botón "Finalizar y Cerrar Turno"
- **Concurrencia Optimista**:
  - Envío obligatorio de cabeceras `expected-version`, `Idempotency-Key` y `X-Correlation-ID`.
  - Manejo de error 409 Conflict: Sincronización automática de snapshot sin pérdida de estado.

### 2.3 Pantalla Pública (`SCR-PUB-001`)
- **Streaming Reactivo**:
  - Conexión persistente `EventSource` a `/api/v1/public-display/stream`.
  - Recepción de eventos `ticket.called` y `ticket.recalled`.
  - Fallback y sincronización mediante snapshot inicial `/api/v1/public-display/snapshot`.
- **Llamados Recientes**:
  - Máximo 4 llamados anteriores.
  - Visualización sin badges de estado (únicamente número de turno y cubículo).
- **Accesibilidad y Audio**:
  - Botón accesible para activar/silenciar anuncio sonoro (`aria-label`).
  - Cero dependencias sintéticas complejas: oscilador Web Audio API nativo estándar hospitalario.
