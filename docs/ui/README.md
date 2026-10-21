# Matrices de Interfaz Aprobadas — Cubiora (PMV v1.0)

Este directorio contiene única y exclusivamente la especificación y matrices de las interfaces oficiales aprobadas para el sistema Cubiora. Cualquier componente fuera de estas matrices ha sido trasladado a `docs/archive/rejected-prototypes/`.

---

## 1. Matriz de Pantallas Aprobadas

| Identificador   | Ruta Web     | Perfil / Rol       | Contrato Visual | Descripción                                                                                                                                                                                                                                         |
| :-------------- | :----------- | :----------------- | :-------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SCR-REC-001** | `/recepcion` | `RECEPTIONIST`     | Recepción       | Emisión ágil de turnos. Muestra últimos 3 turnos (Turno, Hora, Cubículo, Estado) con **Cero PII**. Notificación y copia de código.                                                                                                                  |
| **SCR-CAJ-001** | `/cajero`    | `CASHIER`          | Mi Cubículo     | Operación de cubículo exclusivo. Snapshot real con `waitingCount`, `serverTime` y documento enmascarado. Comandos atómicos (`call`, `start-service`, `close`, `no-show`) con `expected-version`/`If-Match`, `Idempotency-Key` y `X-Correlation-ID`. |
| **SCR-PUB-001** | `/pantalla`  | Público (Sin auth) | Sala de Espera  | Visualización pública de llamados en tiempo real vía SSE. Turno llamado principal, últimos llamados, control de audio accesible y **estricto Cero PII** (sin nombres ni documentos).                                                                |

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

- **Fuente de Verdad**:
  - `GET /api/v1/cubicles/{cubicleCode}/current` entrega `cubicle`, `activeTicket`, `waitingCount` y `serverTime`.
  - El único estado persistido que se representa es el del snapshot: `ASSIGNED`, `CALLED` o `IN_SERVICE`. Sin turno activo se representa `AVAILABLE`.
  - Los comandos usan `POST /api/v1/tickets/{publicId}/{call|start-service|close|no-show}` con sesión autenticada, `Idempotency-Key`, `X-Correlation-ID`, `expected-version` e `If-Match`.
- **Mapeo de Estados Visuales**:
  | Estado persistido | Estado visual base | Acciones principales |
  | :--- | :--- | :--- |
  | Sin turno activo | `AVAILABLE` | Verificar conexión / actualizar snapshot |
  | `ASSIGNED` | `ASSIGNED` | Llamar turno |
  | `CALLED` | `CALLED` | Iniciar atención, repetir llamado, paciente no presentado |
  | `IN_SERVICE` | `IN_SERVICE` | Cerrar turno |
- **Estados Transitorios (solo presentación, nunca persistidos)**:
  - `PROCESSING_CALL`, `PROCESSING_START`, `CONFIRM_CLOSE`, `PROCESSING_CLOSE`, `CONFIRM_NO_SHOW`, `PROCESSING_NO_SHOW`.
  - `CLOSED_NEXT`, `CLOSED_NO_NEXT`, `NO_SHOW_NEXT` derivan de la respuesta del comando, no de estado local inventado.
  - `UNCERTAIN_RESULT` aparece cuando una mutación pierde la respuesta; no se reintenta automáticamente. La acción "Verificar estado actual" ejecuta `GET`, muestra `RECONCILING` y solo entonces habilita un nuevo intento.
  - `OFFLINE` representa la falta de conexión confirmada por un fallo de red. Se conserva el último snapshot visible, se deshabilitan las acciones y se ofrece "Verificar conexión".
- **Privacidad**:
  - `activeTicket.maskedDocument` es el único dato documental que llega al navegador. El backend nunca incluye `patientDocument` en el snapshot.
  - El documento se enmascara con `maskDocument`; para documentos de cuatro dígitos o menos se ocultan todos los dígitos.
- **Cola y Tiempo**:
  - `waitingCount` proviene del backend (turnos `PENDING`). Si es cero se muestra "No hay pacientes en espera"; nunca "0 pacientes en espera".
  - Los cronómetros se recalculan desde `serverTime - calledAt` y `serverTime - serviceStartedAt`, ajustando el reloj local con el offset del servidor.
- **Concurrencia y Accesibilidad**:
  - Un `409` consulta el snapshot y representa el estado vigente antes de permitir otro intento.
  - Los modales de confirmación usan foco inicial en la acción segura, focus trap, Escape y bloqueo de cierre mientras procesan.
  - El cierre de sesión se bloquea mientras exista un turno `ASSIGNED`, `CALLED` o `IN_SERVICE`.
- **Capturas de Referencia**:
  - `docs/screenshots/04-cajero-turno-asignado.png`
  - `docs/screenshots/05-cajero-turno-llamado.png`
  - `docs/screenshots/06-cajero-modal-no-presentado.png`
  - `docs/screenshots/07-cajero-modal-cierre.png`
  - `docs/screenshots/08-cajero-cierre-siguiente.png`
  - `docs/screenshots/09-cajero-cierre-sin-siguiente.png`
  - `docs/screenshots/10-cajero-resultado-incierto.png`
  - `docs/screenshots/11-cajero-sin-conexion.png`

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
