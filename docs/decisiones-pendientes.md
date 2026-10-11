# Decisiones Pendientes de Aprobación y Validación — Cubiora

Este documento consolida los aspectos arquitectónicos y de negocio que han quedado deliberadamente acotados para el PMV y que requieren revisión o definición antes del despliegue productivo final.

---

## 1. Política de Retención y Purgado de Historial (Q4)
- **Estado en PMV**: Sin borrado automático. Todo el historial de turnos, llamados y auditorías se conserva permanentemente en base de datos.
- **Acción requerida**:
  - Definir la política de retención en coordinación con el área legal y cumplimiento normativo de historias/atención en salud.
  - Diseñar el mecanismo de archivado (particionamiento por mes/año o migración a almacenamiento frío) para evitar degradación de consultas históricas tras meses de operación intensa.

---

## 2. Tratamiento y Cifrado de Documento del Paciente (`patient_document`) (Q5)
- **Estado en PMV**: Almacenado en texto plano en la base de datos (protegido únicamente por el cifrado de volumen a nivel de servidor). Garantizado que nunca se expone en la pantalla pública (`/pantalla`) ni en logs.
- **Acción requerida**:
  - Realizar revisión jurídica de protección de datos personales (Habeas Data) con el área correspondiente.
  - Evaluar si se requiere cifrado a nivel de aplicación (ej. AES-GCM-256 con claves en gestor de secretos) o si basta con el cifrado de disco y control de acceso RBAC.

---

## 3. Política Operativa de Turnos No Presentados (`NO_SHOW_MAX_CALLS`) (Q3)
- **Estado en PMV**: Configurado provisionalmente en un máximo de **3 llamados** mediante la variable de entorno `NO_SHOW_MAX_CALLS=3`.
- **Acción requerida**:
  - Validar empíricamente con el equipo de operaciones de farmacia si 3 llamados representan el balance óptimo entre agilidad de la fila y tiempo de desplazamiento de usuarios con movilidad reducida.

---

## 4. Cantidad y Configuración Dinámica de Cubículos (Q1)
- **Estado en PMV**: Seed inicial configurado con **3 cubículos activos** para desarrollo local.
- **Acción requerida**:
  - Validar la cantidad real de cubículos disponibles en la sede piloto física para ajustar el seed o interfaz administrativa de cubículos.
