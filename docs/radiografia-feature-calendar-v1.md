# Radiografía — Rama `feature/calendar-v1`

## Contexto
- **Objetivo:** llevar el módulo `/calendar` a paridad funcional con `/schedule` (gestión de clases), con UX mejorada y permisos por rol.
- **Rama:** `feature/calendar-v1`
- **Último commit:** `310dacb` — `calendar: avoid flushSync warning on datesSet`
- **Estado:** cambios commiteados y pusheados a `origin/feature/calendar-v1`.

### Commits relevantes recientes (para troubleshooting)
- `310dacb` — `calendar: avoid flushSync warning on datesSet`
- `50a1249` — `calendar: availability mode for finding free slots`
- `2237fdc` — `calendar: improve month view readability`
- `2bb975c` — `layout: fix hydration mismatch for impersonation banner`
- `cdb6998` — `calendar: improve mobile UX (height, toolbar, sticky actions)`
- `e3eb883` — `calendar: fix hydration + remove student_plans is_active filter`

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
- FullCalendar con vistas tengo tengo (desktop: week; mobile: day/week/month con toggle).
- Carga automática por **rango visible** (`datesSet`) y por cambio de academia seleccionada.
- Eventos combinados:
  - **Clases (`class_sessions`)**
  - **Bloqueos (`calendar_blocks`)**
  - **Eventos manuales (`calendar_manual_events`)**
- Paleta y estilos scoped dentro de `.agendo-calendar`.

#### Vista Mes (legibilidad)
- Render custom solo para `dayGridMonth`:
  - Línea principal: `hora · cancha`
  - Línea secundaria: `profe · n` (n = alumnos)
- Orden en mes: por hora y luego por cancha (evita mezcla/confusión cuando hay varias canchas a la misma hora).
- En mobile: límite de eventos visibles por día + `+X más`.

#### Modo “Huecos” / Disponibilidad (semana/día)
- Disponible como botón **`Huecos`** (solo en `timeGridDay` y `timeGridWeek`, para roles que pueden crear).
- Pinta el calendario con **eventos de fondo** (background) por slot horario de 60 minutos:
  - Verde: muchas canchas libres
  - Amarillo: pocas libres
  - Rojo: 0 libres
- Objetivo: identificar rápidamente horarios con capacidad para crear/reagendar.

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

#### Crear con “Huecos” activo (ayuda visual)
- Con `Huecos` activo y con `fecha/hora` seleccionadas:
  - En el selector de **cancha** se deshabilitan canchas ocupadas para ese slot (aparecen con sufijo `(ocupada)`).
  - Se muestra un hint: `Libres: X/Y`.

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

### 10) Mejoras mobile (calendario + modales)
- FullCalendar en mobile usa altura calculada para una experiencia “app-like” (evita doble scroll raro).
- Toolbar mobile más compacta.
- Footers sticky en modales (Detalle / Advertencia / Crear) para que los botones estén siempre accesibles.
- Popover de alumnos full-width en mobile.

### 11) Fixes de estabilidad (debugging)
- Fix hydration mismatch por banner sticky de impersonación en `DashboardLayout`.
- Fix warning `flushSync was called...` difiriendo actualizaciones disparadas en `datesSet`.

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

### A2) Crear clase usando “Huecos” (disponibilidad)
> Recomendado hacerlo en `Semana` y `Día`.
- [ ] En `Semana` o `Día`, activar botón `Huecos`.
- [ ] Verificar colores:
  - [ ] Un slot con muchas canchas libres se ve verde.
  - [ ] Un slot sin canchas libres se ve rojo.
- [ ] Tocar un horario libre (verde/amarillo) y crear clase.
- [ ] En el modal, seleccionar complejo y revisar el selector de canchas:
  - [ ] Las canchas ocupadas para ese horario aparecen deshabilitadas con `(ocupada)`.
  - [ ] Se muestra `Libres: X/Y`.

### B) Crear clase en el pasado
- [ ] Seleccionar fecha/hora pasada -> aparece advertencia -> continuar -> se crea.

### C) Editar clase
- [ ] Cambiar solo profesor (push rescheduled).
- [ ] Cambiar cancha (valida choque).
- [ ] Cambiar fecha/hora (valida choque).
- [ ] Agregar alumno (booking insert + plan_usages pending upsert).
- [ ] Quitar alumno (booking delete + plan_usages refunded + push cancelled a removidos).
- [ ] Verificar `capacity/type` (individual vs grupal) se actualiza según cantidad.

### C2) Editar/Reagendar usando “Huecos” (manual)
> Por ahora `Huecos` es una guía visual; el flujo de reagendar sigue siendo el formulario `Editar`.
- [ ] Abrir una clase y entrar a `Editar`.
- [ ] Activar `Huecos` en el calendario (vista `Día` o `Semana`).
- [ ] Buscar un slot con disponibilidad (verde/amarillo) y reprogramar manualmente en el formulario.

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

### F) Push (Web Push)
- [ ] Crear clase -> llega push `class-created`.
- [ ] Editar moviendo fecha/hora -> llega push `class-rescheduled`.
- [ ] Editar quitando alumno -> llega push `class-cancelled` (solo al alumno removido).
- [ ] Cancelar clase completa -> llega push `class-cancelled`.

### G) Mobile UX
- [ ] En mobile, el calendario no debería tener “doble scroll” raro; la altura se adapta.
- [ ] Toolbar mobile se ve compacta.
- [ ] En modales, los botones (footer) quedan sticky y siempre accesibles.
- [ ] Popover de alumnos no se corta (full-width).

### H) Vista Mes (legibilidad)
- [ ] En `Mes`, con varias clases a la misma hora en distintas canchas:
  - [ ] Debe verse `hora · cancha` de forma clara.
  - [ ] Debe verse un meta corto `profe · n`.
  - [ ] El orden debe ser consistente (hora + cancha).

---

## Pendientes (qué falta para paridad completa)

### 1) QA formal del flujo de edición (alto)
- Ejecutar QA completo de `Editar` (ver checklist C) y confirmar:
  - consistencia de `plan_usages`
  - pushes en escenarios reales
  - edge cases (sin alumnos, cambios múltiples, etc.)

### 2) Histórico / auditoría (medio)
- Mostrar historial de acciones (crear/editar/cancelar/asistencia) en el modal de detalle como `/schedule`.

### 3) Recurrencia (medio)
- Crear clases recurrentes desde `/calendar` (paridad con `/schedule`).

### 4) Mejoras mobile (alto)
- Iterar UX mobile según feedback real (en especial vista Mes y el modo Huecos).

### 5) Disponibilidad (alto)
- **Mes (pendiente):** agregar indicador de densidad/capacidad por día (macro) para ver “días con huecos” sin entrar a semana.
- **Reagendar asistido (pendiente):** permitir que en modo `Huecos` un tap en slot prellene `Editar` (fecha/hora) o abra selector de canchas libres.

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
1) Ejecutar QA de `Editar` (ver checklist C) y corregir inconsistencias si aparecen.
2) Implementar disponibilidad macro en `Mes` (densidad/capacidad por día).
3) Implementar reagendar asistido usando `Huecos` (tap para prellenar).
4) Implementar Histórico (#136).
5) Implementar Recurrencia (#137).
