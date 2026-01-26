# Handoff / Radiografía — Super Admin Dashboard + Facturación + Notificaciones

Fecha: 2026-01-26

## 1) Objetivo principal
Implementar y estabilizar un **sistema robusto de facturación y notificaciones** para el rol **super_admin**, separando claramente:

- **Factura generada (invoice issued)**
- **Pago registrado por academia (invoice payment registered)**
- **Comisiones de vendedores/asesores**
  - **Comisión pendiente** (cuando la academia paga a Agendo)
  - **Comisión pagada** (cuando Agendo paga al vendedor)

Además, se trabajó en la UX del super admin (dashboard y modo impersonación) para administrar academias de forma fluida.

---

## 2) Estado actual (qué ya está hecho)

### 2.1 Dashboard Super Admin (UI)
- Dashboard global para `super_admin` con cards nuevas:
  - ranking mensual de academias (basado en `billing_payments`)
  - selector “ver como admin” (impersonación)
  - resumen de usuarios/alumnos por academia
- Ajustes de layout/padding para evitar solapamiento con `FooterNav` fijo.

Archivos relevantes:
- `src/app/(dashboard)/SuperAdminHomeClient.tsx`
- `src/app/(dashboard)/SuperAdminAcademyRankingCard.tsx`
- `src/app/(dashboard)/SuperAdminImpersonateAcademyCard.tsx`
- `src/app/(dashboard)/SuperAdminUsersByAcademyCard.tsx`
- `src/app/(dashboard)/SuperAdminIncomeExpensesCard.tsx`

### 2.2 Modo impersonación (super_admin → admin)
- `super_admin` puede “ver como admin” de una academia:
  - Se guarda `impersonateAcademyId` en `localStorage`.
  - Se calcula un `effectiveRole` para que la UI funcione como admin.
  - Se bloquean rutas `/super-admin/*` mientras se impersona.
  - Banner global con botón para salir de impersonación.
- Fix de flickers:
  - Inicialización de rol y estado de impersonación desde `localStorage`.
  - Corrección de duplicación de menús/footer durante navegación.

Archivos relevantes:
- `src/app/(dashboard)/layout.tsx`
- `src/app/page.tsx`
- `src/components/footer-nav.tsx`

### 2.3 Facturación: separar “factura” vs “pago”
- En `/super-admin/billing`:
  - se generan facturas (`billing_invoices`)
  - se registran pagos (`billing_payments`)
  - se distingue claramente evento “factura emitida” y “pago registrado”

#### Fecha de pago efectivo
- Se agregó selector para que al registrar pago se guarde `billing_payments.paid_at` como **fecha efectiva** del pago.

Archivo:
- `src/app/(dashboard)/super-admin/billing/page.tsx`

---

## 3) Notificaciones (push + in-app + email)

### 3.1 Factura generada (admins de la academia)
Endpoint:
- `POST /api/billing/invoice-issued`

Acciones:
- in-app: `notifications` (via `createInAppNotifications`)
- push web: `push_subscriptions` (VAPID)
- push mobile: OneSignal
- email: nodemailer (plantilla reutilizada)

Destinatarios:
- usuarios con `user_academies.role = 'admin'` y `is_active = true`
- email se resuelve desde `profiles.email` y fallback a `auth.users.email`

### 3.2 Pago registrado (admins de la academia)
Endpoint:
- `POST /api/billing/invoice-payment-registered`

Acciones:
- in-app + push web + OneSignal + email a admins (igual que factura)

---

## 4) Vendedores / Comisiones

### 4.1 Email al vendedor cuando se genera factura (comisión estimada)
Implementado en:
- `POST /api/billing/invoice-issued`

Comportamiento:
- Busca asignación vigente en `billing_academy_sales_agents`.
- Resuelve vendedor en `billing_sales_agents`.
- Calcula comisión estimada: `invoice_total * commission_rate`.
- Envía email al vendedor con el monto de comisión.

Nota:
- Este email es por **evento factura generada** (estimación / expectativa).

### 4.2 Registro de comisión “pendiente” cuando se registra pago de academia
Implementado en:
- `POST /api/billing/invoice-payment-registered`

Comportamiento:
- Para el período seleccionado (`periodYear`, `periodMonth`) y el pago `amount`:
  - Detecta asignación vigente por fecha (`paidAt` o fecha actual) en `billing_academy_sales_agents`.
  - Para cada vendedor vigente:
    - Upsert lógico (select + insert/update) sobre `billing_sales_commissions` por:
      - `sales_agent_id`, `period_year`, `period_month`
    - Suma:
      - `base_paid_amount += amount`
      - `commission_amount += amount * commission_rate`
    - Mantiene `status = 'pending'`
  - Envía email al vendedor:
    - monto registrado por la academia
    - comisión por ese pago
    - acumulado del período (base y comisión pendiente)

Tabla:
- `billing_sales_commissions`

### 4.3 Marcar comisión como pagada (Agendo → vendedor) + email
Endpoint nuevo:
- `POST /api/billing/commission-mark-paid`

Comportamiento:
- Marca en `billing_sales_commissions`:
  - `status = 'paid'`
  - `paid_at = <fecha>`
- Envía email al vendedor confirmando el pago.

### 4.4 UI: Pagos a vendedores (Agendo)
En `/super-admin/billing` → sección “Vendedores y comisiones”:

- Se agregó panel “**Pagos a vendedores (Agendo)**” basado en `billing_sales_commissions` del período.
- Permite:
  - ver base/comisión
  - ver estado `pending` / `paid` (y fecha)
  - seleccionar fecha y marcar pagada (llama `/api/billing/commission-mark-paid`)

Archivo:
- `src/app/(dashboard)/super-admin/billing/page.tsx`

---

## 5) Tablas / DB involucrada

Migración relevante:
- `supabase/migrations/20260125104000_billing_agendo.sql`

Tablas principales:
- `billing_invoices` (facturas)
- `billing_payments` (pagos)
- `billing_sales_agents` (vendedores)
- `billing_academy_sales_agents` (asignaciones vigentes con %)
- `billing_sales_commissions` (acumulado mensual + status paid/pending)
- `notifications` (in-app)
- `push_subscriptions` (push web)

---

## 6) Flujo end-to-end (cómo debería funcionar)

### A) Super Admin genera factura
1. UI crea `billing_invoices`.
2. Se llama `POST /api/billing/invoice-issued`.
3. Se notifica a admins.
4. Se envía email a vendedor asignado con comisión estimada.

### B) Super Admin registra pago de factura
1. UI inserta `billing_payments` con `paid_at` editable.
2. Se llama `POST /api/billing/invoice-payment-registered`.
3. Se notifica a admins.
4. Se acumula comisión pendiente en `billing_sales_commissions`.
5. Se envía email a vendedor informando el registro del pago y la comisión pendiente.

### C) Agendo paga al vendedor
1. Super admin marca en UI “Pagos a vendedores (Agendo)” → “Marcar pagada”.
2. Se llama `POST /api/billing/commission-mark-paid`.
3. Se actualiza status `paid` y `paid_at`.
4. Se envía email al vendedor confirmando pago.

---

## 7) Rama y merge
- Se trabajó en `feature/super-admin-dashboard`.
- Se realizó commit y merge directo a `main`.

---

## 8) Pendientes / Próxima iteración

### 8.1 Seguridad/Permisos
Pendiente validar explícitamente:
- Que **solo `super_admin`** pueda:
  - registrar pagos de factura
  - marcar comisiones como pagadas

Recomendación:
- Validar server-side (en endpoints) usando auth/claims y denegar si no es super_admin.

### 8.2 Robustez de comisiones
Decidir si se requiere:
- comisión por **factura** (snapshot al emitir) vs comisión por **pagos reales** (actual)
- soporte de múltiples vendedores vigentes al mismo tiempo (actualmente soportado al registrar pago)

### 8.3 Validación end-to-end
Checklist manual:
- Configurar SMTP (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`).
- Tener vendedor con email en `billing_sales_agents`.
- Tener asignación vigente en `billing_academy_sales_agents`.
- Generar factura → validar correo a admins + vendedor.
- Registrar pago → validar correo a admins + vendedor + fila en `billing_sales_commissions`.
- Marcar comisión pagada → validar update y correo.

---

## 11) Recordatorio acordado (próxima sesión)
La validación de **permisos/seguridad** y las **pruebas end-to-end** quedaron intencionalmente para la próxima iteración.

Checklist rápido (próxima sesión):
- Confirmar que los endpoints de billing deniegan requests si el usuario autenticado no es `super_admin`.
- Probar flujo completo con datos reales (1 academia + 1 vendedor asignado):
  - Factura emitida → admin(s) + vendedor (email).
  - Pago registrado → admin(s) + vendedor (email) + acumulado en `billing_sales_commissions`.
  - Comisión marcada pagada → vendedor (email) + status `paid` + `paid_at`.

---

## 9) Archivos clave (mapa rápido)

UI/Layouts:
- `src/app/(dashboard)/layout.tsx`
- `src/app/page.tsx`
- `src/components/footer-nav.tsx`
- `src/app/(dashboard)/SuperAdminHomeClient.tsx`
- `src/app/(dashboard)/super-admin/billing/page.tsx`

APIs:
- `src/app/api/billing/invoice-issued/route.ts`
- `src/app/api/billing/invoice-payment-registered/route.ts`
- `src/app/api/billing/commission-mark-paid/route.ts`

Helpers:
- `src/lib/in-app-notifications.ts`
- `src/lib/onesignal-server.ts`

---

## 10) Notas operativas
- Los emails usan una plantilla HTML inspirada en el email de bienvenida (gradiente + CTA).
- `NOTIFICATION_CC_EMAILS` puede forzar CC a un conjunto de correos.
- Push web requiere VAPID keys.
- OneSignal requiere configuración previa (ya se usa en el proyecto).
