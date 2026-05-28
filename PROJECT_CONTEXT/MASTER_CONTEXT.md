# MASTER_CONTEXT

## 1. Identidad del proyecto

**Nombre:** AGENDO / App Academia.

**Tipo:** aplicación SaaS multi-academia para gestión operativa de academias de pádel.

**Objetivo de negocio:** centralizar agenda de clases, alumnos, planes, pagos, reportes, usuarios, notificaciones y administración global de academias en una plataforma web/PWA con wrapper móvil.

**Usuarios objetivo:**
- `super_admin`: administra el sistema global, academias, sedes/canchas, asignaciones, billing Agendo y reportes globales.
- `admin`: opera una o más academias asignadas.
- `coach`: gestiona/verifica clases propias, asistencia y alumnos según permisos.
- `student`: consulta agenda, pagos/notificaciones y perfil.

**Plataformas:**
- Web/PWA Next.js.
- Mobile híbrido Capacitor Android/iOS apuntando al web app productivo.
- Producción documentada: `https://agendo.nativatech.com.py`.
- Staging/Capacitor documentado: `https://capacitor.nativatech.com.py`.

## 2. Stack real

**Frontend:**
- Next.js `16.1.1` con App Router.
- React `19.2.1`.
- TypeScript.
- Tailwind CSS v4.
- Componentes propios estilo shadcn/ui en `src/components/ui`.
- Radix UI para Dialog, Popover, Select.
- `lucide-react` para iconografía.
- `sonner` para toasts.
- `framer-motion` para animaciones puntuales.
- FullCalendar para `/calendar`.
- Recharts para visualización de reportes.

**Backend:**
- Next.js Route Handlers bajo `src/app/api/*`.
- Server Components puntuales para auth inicial.
- Endpoints server-side con `supabaseAdmin` cuando se requiere service role.

**Base de datos y auth:**
- Supabase Auth.
- Supabase Postgres con RLS.
- Supabase Storage usado para avatar/perfil.
- Migraciones en `supabase/migrations/`.
- Baselines productivos en migraciones `20260101231624_baseline_prod.sql` y `20260108190406_baseline_prod.sql`.

**Notificaciones y correo:**
- Web Push con `web-push`, VAPID y service worker en `public/sw.js`.
- In-app notifications en tabla `notifications`.
- OneSignal server para mobile/native push.
- Nodemailer/SMTP para emails transaccionales.
- Crons Vercel definidos en `vercel.json`.

**Mobile:**
- Capacitor en `mobile/`.
- App ID: `com.nativatech.agendo`.
- App name: `Agendo`.
- URL nativa actual: `https://agendo.nativatech.com.py`.
- Deep links: esquema `agendo://` y app/universal links documentados.
- Biometría y secure storage en `src/lib/capacitor-biometrics.ts`.

**Exportaciones / documentos:**
- `exceljs`, `jspdf`, `jspdf-autotable`.

## 3. Arquitectura

**Estilo:** monolito Next.js App Router con UI client-heavy para dashboard y Route Handlers como backend BFF sobre Supabase.

**Carpetas principales:**
- `src/app/(auth)`: login y registro.
- `src/app/(dashboard)`: layout autenticado y módulos operativos.
- `src/app/api`: endpoints de administración, auth, cron, push, billing, asistencia y reservas.
- `src/components`: navegación, prompts PWA/push, campana, avatar y UI base.
- `src/lib`: clientes Supabase, auth, auditoría, formatters, notificaciones, OneSignal, Capacitor.
- `supabase/migrations`: fuente de verdad de cambios DB.
- `docs`: handoffs, manuales, playbooks y especificaciones técnicas.
- `mobile`: proyecto Capacitor Android/iOS.
- `PROJECT_CONTEXT`: memoria persistente para agentes IA.

**Rutas funcionales:**
- Públicas: `/login`, `/register`, `/privacy-policy`, `/support`.
- Dashboard: `/`, `/schedule`, `/calendar`, `/students`, `/finance`, `/reports`, `/settings`, `/users`, `/profile`.
- Super admin: `/super-admin/academias`, `/super-admin/locations`, `/super-admin/asignaciones`, `/super-admin/billing`, `/super-admin/reports`.

**Auth y routing:**
- `src/middleware.ts` protege rutas no públicas y redirige a `/login`.
- La sesión se refresca con Supabase auth helpers.
- `requireUser()` se usa en Server Components cuando corresponde.
- `/calendar` tiene una regla UX específica: si expira sesión, no fuerza `next=/calendar`.

**Multi-academia:**
- Tabla clave: `user_academies`.
- `profiles.role` mantiene rol principal.
- `user_roles` permite roles adicionales.
- `user_academies.role` y `user_academies.is_active` gobiernan pertenencia/actividad por academia.
- `super_admin` tiene acceso global, pero puede impersonar una academia como admin mediante `impersonateAcademyId`.
- La academia activa se guarda en `localStorage` como `selectedAcademyId`.
- El rol cacheado se guarda como `currentUserRole`; el user id como `currentUserId`.

**Impersonación:**
- Implementada para `super_admin` desde el dashboard.
- Usa `impersonateAcademyId`, `impersonateAcademyName` y `selectedAcademyIdBeforeImpersonation`.
- Mientras se impersona, el rol efectivo se comporta como `admin` y se bloquean rutas `/super-admin/*`.

## 4. Modelo de datos alto nivel

**Core operativo:**
- `academies`, `academy_locations`
- `locations`, `courts`
- `profiles`, `user_roles`, `user_academies`
- `students`, `coaches`
- `class_sessions`, `bookings`, `attendance`
- `plans`, `student_plans`, `payments`, `plan_usages`
- `class_notes`, `audit_logs`

**Calendario v1:**
- `calendar_manual_events`
- `calendar_blocks`
- `class_sessions.status`
- RPC `get_students_remaining_classes(p_academy_id)`

**Notificaciones:**
- `push_subscriptions`
- `notification_events` para anti-spam
- `notifications` para in-app notifications

**Costos / reportes:**
- `coach_academy_fees`
- `location_rent_fees`, `court_rent_fees`
- `location_rent_fees_per_student`, `court_rent_fees_per_student`

**Billing Agendo:**
- `billing_academy_rates`
- `billing_invoices`
- `billing_payments`
- `billing_sales_agents`
- `billing_academy_sales_agents`
- `billing_sales_commissions`

**Control de estado:**
- `academies.is_suspended`
- `user_academies.is_active`
- `user_deactivation_requests`

## 5. Funcionalidades actuales

**Autenticación y registro:**
- Login email/password.
- Registro manual en `/register`.
- Registro OAuth Google/Apple con código de academia.
- Código de academia resuelto por `academies.slug`.
- Auto-registro crea usuario `student`, perfil, roles, asignación activa y alumno.
- Modal de completar perfil post OAuth si faltan datos obligatorios.
- Bloqueo de registro/acceso para academia suspendida.

**Agenda clásica `/schedule`:**
- Crear, editar, reprogramar, cancelar clases.
- Clases recurrentes con saldo por alumno.
- Validaciones de cancha, alumno, profesor y saldo.
- Asistencia con `attendance` y consumo de `plan_usages`.
- Historial/auditoría vía `audit_logs`.
- Horarios de agenda extendidos hasta 23:00.
- Clases recientes para asistencia se muestran hasta 24h y se ocultan al guardar asistencia.

**Calendario `/calendar`:**
- FullCalendar con vistas día/semana/mes.
- Eventos combinados: clases, bloqueos y eventos manuales.
- Crear/editar/cancelar clases, asistencia y validaciones de saldo.
- Modo "Huecos" para disponibilidad visual por slots.
- UX móvil específica.
- `admin` y `coach` operan según permisos; `super_admin` queda mayormente read-only según commits recientes.

**Usuarios `/users`:**
- Alta manual de usuarios.
- Importación CSV masiva.
- Edición de datos, roles y registros `students`/`coaches`.
- Filtros por academia y estado.
- Estado activo/inactivo por academia mediante `user_academies.is_active`.
- Switch de estado visible para `super_admin`.
- Admin puede solicitar inactivación; `super_admin` ejecuta cambios.
- Emails de bienvenida y notificación a super admins en flujos relevantes.

**Alumnos `/students`:**
- Listado por academia activa.
- Plan vigente, saldo de clases, pagos, historial, asistencia y notas.

**Finanzas `/finance`:**
- Planes.
- Asignación de planes.
- Pagos.
- Saldos pendientes.
- Push de pagos y recordatorios.

**Reportes `/reports`:**
- Ingresos.
- Egresos por profesor.
- Ganancia/métricas.
- Exportaciones Excel/PDF.
- Reportes por alumno, plan, profesor, sede/cancha y asistencia.

**Configuración `/settings`:**
- Selección de academia activa.
- Preferencias de notificaciones.
- Biometrics en contexto Capacitor.
- Configuración de alquiler por sede/cancha y modos de rentas.

**Super admin:**
- CRUD de academias.
- Suspensión de academia.
- Sedes/canchas y vínculos academia-sede.
- Asignaciones usuario-academia-rol.
- Dashboard global, ranking, usuarios por academia, ingresos/egresos.
- Impersonación de academia.
- Billing Agendo: facturas, pagos, vendedores y comisiones.

**Notificaciones:**
- Push por clase creada/cancelada/reprogramada.
- Push de recordatorios de clase hoy/mañana.
- Push de pago pendiente, pago registrado, saldo.
- Cumpleaños alumno/admin.
- Asistencia pendiente.
- In-app + push + email en flujos de billing.

## 6. Estado real de avance

**Completado / operativo:**
- Base Next + Supabase + PWA.
- Roles principales y multi-academia.
- Agenda clásica.
- Usuarios, importación, roles, actividad por academia.
- Registro manual/social con código de academia.
- Calendario v1 funcional con disponibilidad y mobile UX.
- Notificaciones push/web, in-app parcial y correos transaccionales.
- Billing super-admin con facturas, pagos y comisiones.
- Wrapper Capacitor con deep links básicos y biometría.
- Crons Vercel para recordatorios y alertas.

**En validación / estabilización:**
- Paridad completa entre `/schedule` y `/calendar`.
- QA formal de edición en calendario, especialmente `bookings`, `plan_usages` y pushes.
- Seguridad server-side de algunos endpoints nuevos de billing y administración.
- Flujo real de suspensión/inactivación por academia en todos los módulos.
- Mobile store readiness final.

**Pendiente documentado / futuro:**
- Pagos in-app Bancard multi-merchant.
- Historial/auditoría visible en modal de calendario.
- Mejoras en reportes: margen por profesor, rangos rápidos, filtros sede/cancha, resumen superior.
- Historial de tarifas de profesor.
- Mejoras de importación CSV: plantilla, alias de academia, log de importaciones, exportar errores.
- Asistente/IA opcional basada en docs o heurísticas.

## 7. Variables de entorno relevantes

**Supabase:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**URLs:**
- `NEXT_PUBLIC_BASE_URL`
- `APP_BASE_URL`

**Push web:**
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

**Cron:**
- `CRON_SECRET`

**Email:**
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `NOTIFICATION_CC_EMAILS`

**OneSignal:**
- `ONESIGNAL_APP_ID`
- `ONESIGNAL_REST_API_KEY`

## 8. Referencias importantes

- `README.md`
- `docs/manual-admin.md`
- `docs/manual-super-admin.md`
- `docs/notificaciones-push.md`
- `docs/radiografia-feature-calendar-v1.md`
- `docs/feature-register-v1-handoff.md`
- `docs/feature-capacitor-v1-handoff.md`
- `docs/super-admin-billing-notifications-handoff.md`
- `docs/mobile-pagos-bancard-multimerchant.md`
- `docs/db-changes-playbook.md`
- `docs/bulk-import-improvements.md`
- `docs/reports-and-coach-fees-improvements.md`
- `supabase/migrations/`
- `vercel.json`

## 9. Riesgos conocidos

- Mucha lógica crítica vive en Client Components grandes (`schedule`, `calendar`, `users`, `finance`). Cualquier cambio debe ser muy localizado.
- `selectedAcademyId` y roles cacheados en `localStorage` son convenientes para UX, pero no deben ser la única fuente de permisos.
- Los endpoints con `supabaseAdmin` deben validar permisos server-side siempre.
- Notificaciones dependen de muchos filtros: permisos, `push_subscriptions`, `profiles.notifications_enabled`, `user_academies.is_active` y academia del evento.
- Los flujos de `plan_usages` son sensibles: `pending`, `confirmed`, `refunded` afectan saldo real.
- Hay features implementadas por ramas/handoffs; antes de refactorizar, leer docs relevantes y commits recientes.
