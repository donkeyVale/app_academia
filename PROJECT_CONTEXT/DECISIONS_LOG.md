# DECISIONS_LOG

Registro de decisiones importantes del proyecto. Mantener entradas breves, fechadas y orientadas a continuidad.

## 2026-05-28

**Decisión:** Crear `PROJECT_CONTEXT` como memoria persistente para agentes IA.

**Razón:** El proyecto ya contiene múltiples módulos, handoffs y decisiones distribuidas en `docs/`; futuros agentes necesitan una fuente compacta y operativa antes de tocar código.

**Impacto:** Nuevas sesiones deben leer `MASTER_CONTEXT.md`, `PROJECT_RULES.md`, `ROADMAP.md` y este log antes de modificar funcionalidad.

## 2026-05-28

**Decisión:** Mantener el web app Next.js como fuente de verdad y usar Capacitor como wrapper móvil.

**Razón:** La arquitectura actual ya apunta el wrapper Capacitor a `https://agendo.nativatech.com.py`, evitando duplicar lógica nativa y manteniendo un backend/UI centralizado.

**Impacto:** Features móviles deben implementarse primero en el web app, salvo integraciones nativas puntuales como biometría, deep links, haptics o push nativo.

## 2026-05-28

**Decisión:** La multi-academia se resuelve con `user_academies` y academia activa en `localStorage`.

**Razón:** La app opera con usuarios que pueden pertenecer a varias academias y roles por academia. `selectedAcademyId` permite UX fluida mientras `user_academies` permanece como fuente de permisos/datos.

**Impacto:** Todo módulo operativo debe filtrar por academia efectiva. Los endpoints críticos no deben confiar solamente en `localStorage` ni en payload cliente.

## 2026-05-28

**Decisión:** El estado activo/inactivo de usuarios es por academia, no global.

**Razón:** Un usuario puede estar activo en una academia e inactivo en otra. La tabla correcta es `user_academies` con `is_active`.

**Impacto:** UI, permisos y notificaciones deben considerar `user_academies.is_active`. Altas manuales e importaciones deben crear usuarios activos por defecto.

## 2026-05-28

**Decisión:** `profiles.role` se mantiene como rol principal y `user_roles` como roles adicionales.

**Razón:** El proyecto ya usa esta separación para navegación, permisos y compatibilidad con flujos existentes.

**Impacto:** Al editar usuarios, mantener sincronizados `profiles`, `user_roles`, `students`, `coaches` y `user_academies`.

## 2026-05-28

**Decisión:** `super_admin` puede impersonar una academia como admin, pero debe quedar separado de operación global.

**Razón:** La impersonación permite revisar una academia con UX real de admin sin abandonar el rol global.

**Impacto:** Mientras existe `impersonateAcademyId`, el rol efectivo de UI es `admin` y se bloquea `/super-admin/*`. Al salir se restaura academia previa si existe.

## 2026-05-28

**Decisión:** `/schedule` es la referencia histórica de negocio y `/calendar` busca paridad con mejor UX.

**Razón:** El calendario v1 es una evolución visual/operativa, pero debe preservar reglas de saldo, reservas, asistencia, cancelación y notificaciones.

**Impacto:** Cambios en `/calendar` deben compararse contra `/schedule`, especialmente en `bookings`, `plan_usages`, `attendance` y push notifications.

## 2026-05-28

**Decisión:** `plan_usages` modela el consumo real de clases con estados.

**Razón:** Es la pieza crítica para calcular saldos confiables de planes.

**Impacto:** Crear clase debe registrar uso `pending`; asistencia debe confirmar uso; cancelaciones o alumnos removidos deben marcar `refunded`. No cambiar esta semántica sin migración y QA.

## 2026-05-28

**Decisión:** Las notificaciones automáticas deben deduplicarse con `notification_events`.

**Razón:** Los crons pueden reintentar o ejecutarse más de una vez; sin deduplicación habría spam.

**Impacto:** Nuevos crons o recordatorios deben definir clave lógica de deduplicación antes de enviar push/email.

## 2026-05-28

**Decisión:** Billing Agendo distingue factura emitida, pago registrado y comisión pagada.

**Razón:** Facturación a academias y comisiones de vendedores tienen eventos contables y notificaciones diferentes.

**Impacto:** No mezclar `billing_invoices`, `billing_payments` y `billing_sales_commissions`. Las comisiones pendientes se acumulan por pagos reales, no solo por factura emitida.

## 2026-05-28

**Decisión:** Registro público usa código de academia basado en `academies.slug`.

**Razón:** Se eligió una implementación simple y operativa para auto-registro manual/OAuth sin tabla de invitaciones.

**Impacto:** Si se requieren códigos rotativos, expiración o un solo uso, habrá que evolucionar a una tabla de invitaciones.

## 2026-05-28

**Decisión:** Las rutas públicas requeridas por stores y deep links deben quedar fuera del middleware de auth.

**Razón:** Android/iOS, PWA y páginas legales necesitan acceso sin sesión.

**Impacto:** Mantener públicas `/privacy-policy`, `/support`, `/.well-known/*`, `/apple-app-site-association`, `manifest.json`, `sw.js` y assets necesarios.

## 2026-05-28

**Decisión:** Los pagos in-app con Bancard serán multi-merchant por academia y confirmados server-to-server.

**Razón:** Cada academia debe cobrar con sus propias credenciales y el plan no debe acreditarse hasta confirmación del backend.

**Impacto:** Implementación futura debe incluir configuración por academia, intentos de pago, webhook/callback idempotente, eventos de pago y acreditación segura de `student_plans`.
