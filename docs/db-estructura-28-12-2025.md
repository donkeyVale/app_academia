# Estructura de base de datos (backup 28-12-2025)

Fuente: `supabase/db_cluster-28-12-2025@05-21-37.backup`

> Nota: este documento resume las tablas **relevantes del esquema `public`** que aparecen en el backup. Hay más objetos en esquemas `auth`, `storage`, `realtime`, etc.

## Tablas principales (public)

### `academies`
- **Campos**:
  - `id` (uuid, PK, default `gen_random_uuid()`)
  - `name` (text, not null)
  - `slug` (text)
  - `created_at` (timestamptz, default `now()`, not null)

### `academy_locations`
- Relación academia <-> sede.
- **Campos**:
  - `id` (uuid, PK)
  - `academy_id` (uuid, not null)
  - `location_id` (uuid, not null)
  - `created_at` (timestamptz, default `now()`, not null)

### `locations`
- Sedes / complejos.
- **Campos**:
  - `id` (uuid, PK)
  - `name` (text, not null)
  - `academy_id` (uuid, nullable)

### `courts`
- Canchas, pertenecen a una sede (`location_id`).
- **Campos**:
  - `id` (uuid, PK)
  - `location_id` (uuid, nullable)
  - `name` (text, not null)

### `class_sessions`
- Sesiones de clase.
- **Campos**:
  - `id` (uuid, PK)
  - `date` (timestamptz, not null)
  - `type` (text, not null)
  - `capacity` (int, default 1, not null)
  - `coach_id` (uuid, nullable)
  - `court_id` (uuid, nullable)
  - `price_cents` (int, default 0, not null)
  - `currency` (text, default 'PYG', not null)
  - `notes` (text, nullable)

### `bookings`
- Reservas alumno <-> clase.
- **Campos**:
  - `id` (uuid, PK)
  - `class_id` (uuid, nullable)
  - `student_id` (uuid, nullable)
  - `status` (text, default 'reserved', not null)
  - `created_at` (timestamptz, default `now()`, nullable)

### `attendance`
- Asistencia alumno <-> clase.
- **Campos**:
  - `id` (uuid, PK)
  - `class_id` (uuid, nullable)
  - `student_id` (uuid, nullable)
  - `present` (bool, default false, not null)
  - `marked_at` (timestamptz, default `now()`, nullable)

### `plans`
- Planes/paquetes por academia.
- **Campos**:
  - `id` (uuid, PK)
  - `name` (text, not null)
  - `classes_included` (int, not null)
  - `price_cents` (int, not null)
  - `currency` (text, default 'PYG', not null)
  - `expires_days` (int, nullable)
  - `academy_id` (uuid, not null)

### `student_plans`
- Compra/asignación de plan a alumno.
- **Campos**:
  - `id` (uuid, PK)
  - `student_id` (uuid, nullable)
  - `plan_id` (uuid, nullable)
  - `remaining_classes` (int, not null)
  - `purchased_at` (timestamptz, default `now()`, nullable)
  - `base_price` (numeric(10,2), nullable)
  - `discount_type` (text, default 'none')
  - `discount_value` (numeric(10,2), default 0)
  - `final_price` (numeric(10,2), nullable)
  - `academy_id` (uuid, nullable)

### `plan_usages`
- Uso de clases por plan (consumo de clase incluida en el plan).
- **Campos**:
  - `id` (uuid, PK)
  - `student_plan_id` (uuid, not null)
  - `class_id` (uuid, not null)
  - `student_id` (uuid, not null)
  - `used_at` (timestamptz, default `now()`, not null)

### `payments`
- Pagos registrados.
- **Campos**:
  - `id` (uuid, PK)
  - `student_id` (uuid, not null)
  - `student_plan_id` (uuid, not null)
  - `amount` (numeric(10,2), not null)
  - `currency` (text, default 'ARS', not null)
  - `payment_date` (date, default current_date, not null)
  - `method` (text, not null)
  - `status` (text, default 'pagado', not null)
  - `notes` (text, nullable)
  - `created_at` (timestamptz, default `now()`, not null)
  - `updated_at` (timestamptz, default `now()`, not null)
  - `payments_status_check` (status in 'pagado','pendiente','anulado')

### `coaches`
- Profesores.
- **Campos**:
  - `id` (uuid, PK)
  - `user_id` (uuid, nullable)
  - `specialty` (text, nullable)
  - `created_at` (timestamptz, default `now()`, nullable)

### `coach_academy_fees`
- Tarifa por clase del profesor para una academia.
- **Campos**:
  - `id` (uuid, PK)
  - `coach_id` (uuid, not null)
  - `academy_id` (uuid, not null)
  - `fee_per_class` (numeric(12,2), not null)
  - `currency` (text, default 'PYG')
  - `created_at` (timestamptz, default `now()`)
  - `updated_at` (timestamptz, default `now()`)

### `profiles`
- Perfil por usuario.
- **Campos**:
  - `id` (uuid, PK)
  - `full_name` (text)
  - `role` (enum `app_role`, default 'student', not null)
  - `created_at` (timestamptz, default `now()`)
  - `notifications_enabled` (bool, nullable)
  - `default_academy_id` (uuid, nullable)

### `user_roles`
- Roles por usuario (multi-rol).
- **Campos**:
  - `user_id` (uuid, not null)
  - `role` (`app_role`, not null)
  - `created_at` (timestamptz, default `now()`)

### `user_academies`
- Relación usuario <-> academia con rol dentro de esa academia.
- **Campos**:
  - `id` (uuid, PK)
  - `user_id` (uuid, not null)
  - `academy_id` (uuid, not null)
  - `role` (`app_role`, not null)
  - `created_at` (timestamptz, default `now()`, not null)

### `students`
- Alumnos.
- **Campos**:
  - `id` (uuid, PK)
  - `user_id` (uuid, nullable)
  - `level` (text, nullable)
  - `notes` (text, nullable)
  - `created_at` (timestamptz, default `now()`, nullable)

### `push_subscriptions`
- Suscripciones push por usuario/dispositivo.

### `notification_events`
- Anti-spam / dedupe de notificaciones.

### `audit_logs`
- Auditoría de cambios.

## Observaciones relevantes para finanzas/egresos

- Hoy el dominio de finanzas incluye:
  - Ingresos: `payments` asociados a `student_plans` / `plans` por `academy_id`.
  - Egresos: existe `coach_academy_fees` para calcular pago a profesores por clase.
- No aparece una tabla nativa para **alquiler de cancha** (costo al complejo) en este backup.

## Próximo paso sugerido

- Agregar soporte de “alquiler de cancha” como egreso por clase (60 min):
  - tarifa por sede con override por cancha
  - con vigencia (histórico de cambios)
  - y que **no compute** si la clase se elimina por quedarse sin alumnos (flujo actual elimina `class_sessions` cuando el último alumno cancela).
