# Notificaciones de la app (Push / PWA)

Este documento resume las **notificaciones push** que envía la app (Web Push/PWA), qué endpoints las disparan, a quién se envían, qué filtros se aplican (preferencias y multi-academia) y qué payload (título/mensaje) se entrega.

> Nota: esto **no** son “notificaciones in-app” (banners dentro de la app). Esto es **push del navegador** (PWA) vía `web-push`.

---

## Requisitos generales

### Permisos + suscripción
Para que un usuario reciba push:

- Debe **aceptar permisos** del navegador.
- Debe existir una fila en `push_subscriptions` para su `user_id`.
- Debe tener `profiles.notifications_enabled != false`.

### Multi-academia (filtro por academyId)
Varios endpoints filtran destinatarios para que solo se notifique a usuarios que estén asignados a la academia del evento:

- Consultan `user_academies` y verifican que el `user_id` objetivo esté asignado a `academy_id`.

### Limpieza de suscripciones inválidas
La mayoría de endpoints, si `webPush.sendNotification` rechaza con status `404` o `410`, borra ese endpoint en `push_subscriptions` para evitar reintentos repetidos.

---

## Anti-spam de notificaciones automáticas

### Tabla `notification_events`
Se usa para evitar enviar varias veces la misma notificación automática.

Casos actuales:

- **Planes (pagos/saldos)**
  - Clave lógica: `(student_plan_id, event_type)`
  - Debe existir índice único/constraint equivalente:
    - `unique(student_plan_id, event_type)`

- **Recordatorios de clase (hoy/mañana)**
  - Clave lógica: `(student_id, class_id, event_type)`
  - Requiere:
    - columna `class_id uuid`
    - `student_plan_id` debe permitir `NULL` (porque en recordatorios de clase no aplica)
    - índice único/constraint equivalente:
      - `unique(student_id, class_id, event_type)`

Los crons primero hacen `upsert` en `notification_events` y **solo envían push** a los registros que se insertaron recién.

SQL sugerido para soportar recordatorios de clase:
```sql
alter table public.notification_events
  add column if not exists class_id uuid;

alter table public.notification_events
  alter column student_plan_id drop not null;

create unique index if not exists notification_events_student_class_event_uidx
  on public.notification_events (student_id, class_id, event_type);
```

---

# Mapa de eventos y payloads

## 1) Clase creada

- **Endpoint**: `POST /api/push/class-created`
- **Origen**: al crear una clase (desde la app)
- **Destinatarios**:
  - Coach (si `coachId` está presente)
  - Alumnos (si `studentIds` tiene IDs)
- **Filtros**:
  - `profiles.notifications_enabled != false`
  - Multi-academia: el usuario debe estar en `user_academies` con `academy_id = academyId`

### Payload (alumno)
```json
{
  "title": "Nueva clase creada",
  "body": "Tenés una nueva clase...",
  "data": { "url": "/schedule" }
}
```
El `body` es nominal y puede incluir:
- nombre del coach
- fecha/hora (`dateIso`)
- sede/cancha (si se pudo resolver)

### Payload (coach)
```json
{
  "title": "Nueva clase creada",
  "body": "Nueva clase agendada...",
  "data": { "url": "/schedule" }
}
```
El `body` puede incluir el primer alumno y cantidad.

---

## 2) Clase cancelada

- **Endpoint**: `POST /api/push/class-cancelled`
- **Origen**: al cancelar una clase (desde la app)
- **Destinatarios**: depende de quién canceló (`cancelledByRole`)
  - Si cancela **student**: coach + admins de la academia
  - Si cancela **coach**: alumnos + admins
  - Si cancela **admin/super_admin**: coach + alumnos
- **Filtros**:
  - `profiles.notifications_enabled != false`
  - Multi-academia: el usuario debe estar asignado a `academyId`

### Payload
```json
{
  "title": "Clase cancelada",
  "body": "<actor> canceló la clase ...",
  "data": { "url": "/schedule" }
}
```
El `actor` se intenta resolver por `cancelledByUserId` (o por student/coach id).

---

## 3) Clase reprogramada

- **Endpoint**: `POST /api/push/class-rescheduled`
- **Origen**: reprogramación de clase (desde la app)
- **Destinatarios**:
  - Coach (si `coachId`)
  - Alumnos (`studentIds`)
- **Filtros**:
  - `profiles.notifications_enabled != false`
  - Multi-academia: el usuario debe estar asignado a `academyId`

### Payload (alumno)
```json
{
  "title": "Clase reprogramada",
  "body": "Tu clase ... fue reprogramada. <cambios>",
  "data": { "url": "/schedule" }
}
```

### Payload (coach)
```json
{
  "title": "Clase reprogramada",
  "body": "Tu clase ... fue reprogramada. <cambios>",
  "data": { "url": "/schedule" }
}
```

Los `cambios` intentan incluir:
- horario anterior → nuevo (`oldDateIso` → `newDateIso`)
- lugar anterior → nuevo (`oldCourtId` → `newCourtId`)
- “Profesor actualizado” si cambió

---

## 4) Recordatorio de clase

- **Endpoint**: `POST /api/push/class-reminder`
- **Origen**: cron/manual/debug (según cómo lo llamen)
- **Destinatario**: alumno (por `studentId`)
- **Filtros**:
  - `profiles.notifications_enabled != false`
  - Debe tener suscripción en `push_subscriptions`

> Nota: el filtro por **academia** y por `user_academies.is_active=true` se aplica en los endpoints **cron** (ver abajo).

### Payload
```json
{
  "title": "Recordatorio",
  "body": "Recordá que tenés clases agendadas, revisá tu agenda!!",
  "data": { "url": "/schedule", "classId": "...", "dateIso": "..." }
}
```

Input adicional opcional:

- `bodyText` (string): permite variar el texto desde el cron.

### Crons (decisión + anti-spam)

Se generan desde crons separados (para mantener copy y rangos claros):

- `POST /api/cron/class-reminder-today`
  - **Horario**: 07:00 Asunción (UTC-3) = 10:00 UTC
  - **Qué busca**: clases del **día de hoy** (en Asunción)
  - **Texto**: el general (por defecto)
  - **Filtro por academia**: resuelve `academy_id` vía `academy_locations` usando el `location_id` de la cancha
  - **Filtro de actividad**: requiere `user_academies.is_active=true` para el `academy_id` de la clase
  - **Anti-spam**: registra `event_type = 'class_reminder_today'` y deduplica por `(student_id, class_id, event_type)`

- `POST /api/cron/class-reminder-tomorrow`
  - **Horario**: 19:00 Asunción (UTC-3) = 22:00 UTC
  - **Qué busca**: clases de **mañana** (en Asunción)
  - **Texto**: copy específico de “mañana” (vía `bodyText`)
  - **Filtro por academia** y **actividad**: igual que el cron de hoy
  - **Anti-spam**: registra `event_type = 'class_reminder_tomorrow'` y deduplica por `(student_id, class_id, event_type)`

---

## 5) Pago pendiente

### Cron (decisión + anti-spam)
- **Endpoint cron**: `POST /api/cron/payment-pending`
- **Idea**: detecta planes sin pagos “pagado” y genera notificación
- **Anti-spam**: inserta en `notification_events` con:
  - `event_type = 'payment_pending_12h'`
  - `onConflict: 'student_plan_id,event_type'`

Luego llama a:
- **Push**: `POST /api/push/payment-pending`

### Push (envío)
- **Endpoint push**: `POST /api/push/payment-pending`
- **Destinatarios**:
  - Alumno dueño del plan
  - Admins de la academia
- **Filtros**:
  - `profiles.notifications_enabled != false`
  - Multi-academia: se valida que el alumno pertenezca a `academyId`

#### Payload alumno
```json
{
  "title": "Pago pendiente",
  "body": "Se asignó el plan “<planName>” y aún no se registró el pago. Si ya pagaste, avisá al admin para que lo registre.",
  "data": { "url": "/finance" }
}
```

#### Payload admins
```json
{
  "title": "Pago pendiente",
  "body": "<studentName>: Plan “<planName>” asignado el <purchasedAt> y aún no se registró ningún pago.",
  "data": { "url": "/finance" }
}
```

---

## 6) Saldo pendiente

### Cron (decisión + anti-spam)
- **Endpoint cron**: `POST /api/cron/balance-reminder`
- **Idea**: calcula balance y detecta casos como “quedan 2 clases” y balance > 0
- **Anti-spam**:
  - `event_type = 'balance_pending_2_classes'`
  - `onConflict: 'student_plan_id,event_type'`

Luego llama a:
- **Push**: `POST /api/push/balance-reminder`

### Push (envío)
- **Endpoint push**: `POST /api/push/balance-reminder`
- **Destinatarios**:
  - Alumno
  - Admins de la academia
- **Filtros**:
  - `profiles.notifications_enabled != false`
  - Multi-academia: valida pertenencia del alumno a `academyId`

#### Payload alumno
```json
{
  "title": "Saldo pendiente",
  "body": "Te quedan <remainingClasses> clases en “<planName>”. Tenés un saldo pendiente de Gs. <balance>.",
  "data": { "url": "/finance" }
}
```

#### Payload admins
```json
{
  "title": "Saldo pendiente",
  "body": "<studentName>: Le quedan <remainingClasses> clases en “<planName>” y tiene saldo pendiente de Gs. <balance>.",
  "data": { "url": "/finance" }
}
```

---

## 7) Pago registrado (notificación a admins)

- **Endpoint**: `POST /api/push/payment-registered`
- **Origen**: cuando un admin registra un pago (desde UI)
- **Destinatarios**: admins de la academia
- **Filtros**:
  - `profiles.notifications_enabled != false`

### Payload
El título cambia según si fue:
- pago total inicial
- pago final que cancela saldo
- pago parcial

Ejemplo (genérico):
```json
{
  "title": "Pago registrado",
  "body": "<studentName>: Pago parcial/total/final registrado (...) por <planName>. ...",
  "data": { "url": "/finance" }
}
```

---

## 8) Pago registrado (notificación al alumno)

- **Endpoint**: `POST /api/push/payment-student`
- **Origen**: cuando se registra un pago para un alumno
- **Destinatario**: alumno
- **Filtros**:
  - `profiles.notifications_enabled != false`
  - Multi-academia: valida pertenencia del alumno a `academyId`

### Payload
También cambia según clasificación del pago:

- **Pago total** (primero y cubre todo)
- **Pago final** (cancela saldo)
- **Pago parcial**

Ejemplo (genérico):
```json
{
  "title": "Pago registrado" /* o "Cuenta cancelada" */,
  "body": "Se registró un pago ... por <planName>. ...",
  "data": { "url": "/finance" }
}
```

---

## 9) Notificación de prueba

- **Endpoint**: `POST /api/push/send-test`
- **Origen**: manual (para testear)
- **Destinatario**: un `userId`

### Payload
```json
{
  "title": "Notificación de prueba",
  "body": "Si ves esto, las notificaciones push están funcionando.",
  "data": { "url": "/" }
}
```

---

# Variables de entorno (VAPID)
Todos los endpoints push requieren:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (default: `mailto:admin@example.com`)

---

# Notas / mejoras futuras

- Consolidar textos (“copy”) para consistencia.
- Definir textos (“copy”) por tipo de recordatorio (hoy vs mañana) si se quiere más consistencia.
- Eliminar índice único duplicado en `notification_events` (solo dejar uno en `(student_plan_id,event_type)` para no duplicar overhead).
