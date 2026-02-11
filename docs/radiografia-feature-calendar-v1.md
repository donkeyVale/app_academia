# Radiografía — Rama `feature/calendar-v1`

## Contexto
- **Objetivo:** llevar el módulo `/calendar` a paridad funcional con `/schedule` (gestión de clases), con UX mejorada y permisos por rol.
- **Rama:** `feature/calendar-v1`
- **Último commit:** `1eb3683` — `calendar: edit + attendance + allow past create + remaining classes + UI tweaks`
- **Estado:** cambios commiteados y pusheados a `origin/feature/calendar-v1`.

---

## Archivos tocados en esta rama
- **`src/app/(dashboard)/calendar/page.tsx`**
  - Implementación principal del calendario, modales, creación/edición/asistencia, validaciones, updates DB y pushes.
- **`src/app/globals.css`**
  - Estilos scoped para `.agendo-calendar` (FullCalendar) y mejoras mobile/tap targets.
- **`src/components/footer-nav.tsx`**
  - Ajustes de `z-index` del footer y agregado/enriquecido del link a `/calendar` según roles.
- **`src/middleware.ts`**
  - Ajuste UX de redirect: si la sesión expira entrando a `/calendar`, no fuerza volver a `/calendar` post-login.

---

## Funcionalidades implementadas (qué ya existe)

### 1) Visualización de calendario
- FullCalendar con vistas (desktop: week; mobile: day/week/month con toggle).
- Carga automática por **rango visible** (`datesSet`) y por cambio de academia seleccionada.
- Eventos combinados:
  - **Clases (`class_sessions`)**
  - **Bloqueos (`calendar_blocks`)**
  - **Eventos manuales (`calendar_manual_events`)**
- Paleta y estilos scoped dentro de `.agendo-calendar`.

### 2) Detalle de clase (modal)
- Modal de detalle al click en evento.
- Muestra cancha, profesor, reservas, duración.
- Botones por rol:
  - `admin`: puede editar / cancelar / asistencia.
  - `coach`: puede editar / cancelar / asistencia **solo si la clase es suya**.
  - `super_admin` y `student`: solo lectura.

### 3) Crear clase (`+ Nueva clase`)
- Permisos: `admin` y `coach` (coach crea solo para sí mismo).
- Validaciones principales:
  - Complejo/cancha/fecha/hora/profesor.
  - Alumnos: 1..4.
  - Conflicto de cancha (bloquea).
  - Conflicto de alumnos (bloquea).
  - Validación de planes/saldo real (similar a `/schedule`) + límite de clases futuras por plan.
- Writes:
  - Inserta `class_sessions` (capacidad, type, etc.).
  - Inserta `bookings`.
  - Upsert `plan_usages` como `pending`.
- Push:
  - `/api/push/class-created`.

### 4) Crear clases en el pasado (paridad UX con `/schedule`)
- Ahora está habilitado: si se intenta crear en pasado, aparece **modal de advertencia** y permite continuar.

### 5) Editar clase (unificación “Editar”)
- Se reemplaza el concepto de “Reprogramar” por **un solo botón `Editar`**.
- Permite modificar:
  - Complejo/cancha
  - Fecha/hora
  - Profesor
  - Alumnos (agregar/quitar)
- Validaciones:
  - Conflicto de cancha (bloquea).
  - Conflicto de alumnos (bloquea).
  - Conflicto de profesor (warning).
  - Planes/saldo: se valida principalmente para **alumnos agregados**.
- Writes:
  - Update `class_sessions`.
  - Inserta/borra `bookings` (según diferencias).
  - `plan_usages`:
    - upsert `pending` para agregados
    - `refunded` para removidos
- Push:
  - Removidos: `/api/push/class-cancelled` (solo para alumnos quitados).
  - Cambios (fecha/cancha/profe): `/api/push/class-rescheduled`.

### 6) Cancelar clase
- `plan_usages` -> `refunded`
- Borra `attendance` y `bookings`
- `class_sessions.status = cancelled`
- Push `/api/push/class-cancelled`

### 7) Asistencia (paridad con `/schedule`)
- En el modal de detalle:
  - Botón `Asistencia` abre una sección para marcar presentes/ausentes.
  - Carga `bookings` + `attendance` existente.
- Al guardar:
  - Upsert en `attendance` (`class_id, student_id`)
  - `plan_usages`: `pending -> confirmed` para los alumnos marcados
  - `class_sessions.attendance_pending = false`

### 8) Selector de alumnos con indicador de saldo (verde/rojo)
- Tanto en Crear como en Editar:
  - Se usa RPC `get_students_remaining_classes(p_academy_id)`.
  - Se muestra `(<n>)` con color:
    - verde si `> 0`
    - rojo si `0`
  - Fallback: si el RPC no devuelve un alumno, se toma como `0` (para que se vea rojo).

### 9) UX del modal / footer nav
- Ajuste de padding en el modal de detalle (`pb-28`) para que el contenido no quede tapado por el footer nav.
- Botones `Editar` y `Asistencia` ya no cambian a “Ocultar …”; ahora usan estado activo (variant default) y el texto queda fijo.

---

## Cambios de navegación / layout
- `footer-nav.tsx`:
  - Se agregan links a `/calendar` para roles relevantes.
  - `z-index` incrementado para que el footer quede por encima.
- `middleware.ts`:
  - Si te redirige a login desde `/calendar`, no setea `next=/calendar`.

---

## Cómo probar (checklist de QA recomendado)

> Nota: este QA está pensado para ejecutarse como `admin` y como `coach`.

### A) Crear clase
- [ ] Crear una clase futura válida con 1 alumno.
- [ ] Crear una clase grupal 2-4 alumnos.
- [ ] Probar choque de cancha: misma cancha+hora -> debe bloquear.
- [ ] Probar choque de alumno: alumno con clase en ese horario -> debe bloquear.
- [ ] Probar alumno sin saldo: debe verse `(0)` en rojo y debe bloquear al confirmar.

### B) Crear clase en el pasado
- [ ] Seleccionar fecha/hora pasada -> aparece advertencia -> continuar -> se crea.

### C) Editar clase
- [ ] Cambiar solo profesor (push rescheduled).
- [ ] Cambiar cancha (valida choque).
- [ ] Cambiar fecha/hora (valida choque).
- [ ] Agregar alumno (booking insert + plan_usages pending upsert).
- [ ] Quitar alumno (booking delete + plan_usages refunded + push cancelled a removidos).
- [ ] Verificar `capacity/type` (individual vs grupal) se actualiza según cantidad.

### D) Asistencia
- [ ] Abrir asistencia en clase con alumnos.
- [ ] Marcar presentes/ausentes y guardar.
- [ ] Verificar:
  - [ ] filas en `attendance`
  - [ ] `plan_usages` pasa a `confirmed`
  - [ ] `class_sessions.attendance_pending=false`

### E) Permisos
- [ ] `admin` puede editar/cancelar/asistencia.
- [ ] `coach` puede editar/cancelar/asistencia solo si `class_sessions.coach_id === coachSelfId`.
- [ ] `super_admin` no puede crear/editar/cancelar.

---

## Pendientes (qué falta para paridad completa)

### 1) QA formal del flujo de edición (alto)
- Pendiente ejecutar QA completo de `Editar` (ver checklist C) y confirmar:
  - consistencia de `plan_usages`
  - pushes en escenarios reales
  - edge cases (sin alumnos, cambios múltiples, etc.)

### 2) Histórico / auditoría (medio)
- Mostrar historial de acciones (crear/editar/cancelar/asistencia) en el modal de detalle como `/schedule`.

### 3) Recurrencia (medio)
- Crear clases recurrentes desde `/calendar` (paridad con `/schedule`).

### 4) Mejoras mobile (alto)
- Ajustes adicionales de UX mobile:
  - comportamiento de modales, scroll, densidad, etc.

### 5) Permisos UX (alto)
- Confirmar/ajustar que `super_admin` sea 100% read-only en `/calendar`.
- Eventual soporte `student` para ver/gestionar sus reservas (futuro).

---

## Notas técnicas / decisiones tomadas
- “Editar” reemplaza “Reprogramar” para evitar saturación de botones.
- `plan_usages`:
  - al crear/editar: se registra `pending`
  - al marcar asistencia: se confirma `confirmed`
  - al cancelar/quitar alumnos: se marca `refunded`
- Duración fija asumida: **60 minutos**.

---

## Dónde retomar en la próxima interacción
1) Ejecutar QA de `Editar` (pendiente #139) y corregir inconsistencias si aparecen.
2) Implementar Histórico (#136).
3) Implementar Recurrencia (#137).
4) Iterar mejoras mobile (#120).
