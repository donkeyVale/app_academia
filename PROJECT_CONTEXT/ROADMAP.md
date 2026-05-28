# ROADMAP

Estado actualizado: 2026-05-28.

## 1. Estado actual del producto

AGENDO ya no es un MVP vacío: tiene una base funcional amplia para gestión multi-academia, con web/PWA, Supabase, roles, agenda, calendario, alumnos, finanzas, reportes, usuarios, notificaciones, billing super-admin y wrapper móvil Capacitor.

El foco actual debe ser estabilizar, validar permisos, cerrar paridad entre módulos y preparar features de pago/mobile sin degradar lo existente.

## 2. Hecho / operativo

### Base técnica
- Next.js App Router + TypeScript.
- Supabase Auth/DB/RLS.
- PWA con manifest y service worker.
- Middleware de auth con rutas públicas necesarias.
- Vercel crons configurados.
- Proyecto Capacitor Android/iOS en `mobile/`.

### Roles y multi-academia
- Roles `super_admin`, `admin`, `coach`, `student`.
- `profiles`, `user_roles`, `user_academies`.
- Selección de academia activa.
- Actividad por academia con `user_academies.is_active`.
- Suspensión de academias con `academies.is_suspended`.
- Impersonación `super_admin` -> admin por academia.

### Operación de academia
- Agenda clásica `/schedule`.
- Calendario nuevo `/calendar`.
- Gestión de alumnos `/students`.
- Finanzas `/finance`.
- Reportes `/reports`.
- Configuración `/settings`.
- Usuarios `/users`.

### Registro y acceso
- Login email/password.
- Registro manual.
- Registro Google/Apple con código de academia.
- Completar perfil post OAuth.
- Emails de bienvenida.

### Notificaciones
- Web Push para clases, pagos, asistencia, cumpleaños y recordatorios.
- In-app notifications para flujos puntuales.
- OneSignal para mobile/native push.
- Emails transaccionales.
- Deduplicación vía `notification_events` en crons.

### Super admin
- Academias.
- Sedes/canchas.
- Asignaciones usuario-academia-rol.
- Dashboard global.
- Billing Agendo con facturas, pagos y comisiones.
- Reportes globales.

## 3. En curso / requiere estabilización

### Calendario v1
Prioridad: alta.

Pendientes:
- QA formal del flujo Editar:
  - cambio de fecha/hora
  - cambio de cancha
  - cambio de profesor
  - agregar/quitar alumnos
  - actualización de `capacity` y `type`
  - consistencia de `bookings`
  - consistencia de `plan_usages`
  - pushes correctos por escenario
- Confirmar paridad real con `/schedule`.
- Agregar historial/auditoría visible en modal de detalle.
- Validar comportamiento read-only de `super_admin` en todos los caminos.

### Usuarios activos/inactivos
Prioridad: alta.

Estado:
- Switch por academia en detalle para `super_admin`.
- Filtros por academia y estado.
- Alta manual crea `user_academies.is_active=true`.
- Importación masiva depende del default DB `is_active=true`.
- Admin puede solicitar inactivación.

Pendientes:
- QA de todos los módulos con usuarios inactivos.
- Confirmar que notificaciones excluyan siempre `is_active=false`.
- Confirmar que alumnos/profesores inactivos no operen ni aparezcan donde no corresponde.
- Documentar flujo operativo final para admins y super_admin.

### Seguridad server-side
Prioridad: alta.

Pendientes:
- Auditar endpoints que usan `supabaseAdmin`.
- Confirmar permisos estrictos en:
  - billing
  - activación/inactivación
  - importación masiva
  - actualización de usuarios
  - tarifas/rentas
  - push/manual test
- Evitar confiar en `currentUserId` enviado por cliente sin validación suficiente cuando el endpoint maneja datos críticos.

### Mobile / Capacitor
Prioridad: media-alta.

Pendientes:
- Validar deep links post-login con `pendingDeepLink`.
- Confirmar configuración iOS Universal Links con Team ID definitivo.
- Validar biometría en dispositivos reales.
- Confirmar signing Android release.
- Revisar assets store-ready y compatibilidad WebView.

## 4. Próximas mejoras priorizadas

### P0 - Robustez operativa
- QA end-to-end de agenda/calendario.
- QA de usuarios activos/inactivos por academia.
- Auditoría de permisos server-side.
- Validar crons con `CRON_SECRET`, anti-spam y filtros por academia activa.
- Actualizar documentación humana de data model, actualmente incompleta en `docs/architecture/03-data-model.md`.

### P1 - Paridad y UX
- Historial/auditoría en `/calendar`.
- Mejoras de filtros en reportes.
- Resumen superior de ingresos, egresos y ganancia.
- Rangos rápidos de fecha en reportes.
- Modo compacto mobile para reportes.
- Plantilla CSV descargable para importación de usuarios.
- Exportar errores de importación.

### P2 - Finanzas y monetización
- Pagos in-app con Bancard multi-merchant.
- Configuración de credenciales Bancard por academia.
- Webhook/callback idempotente.
- Acreditación automática de planes solo tras confirmación server-to-server.
- Registro de eventos de pago y trazabilidad.

### P3 - Analytics / IA / automatización
- Margen por profesor.
- Historial de tarifas de profesor.
- Alertas inteligentes determinísticas.
- Asistente de soporte basado en documentación interna.
- Redactor de mensajes con plantillas o LLM opcional.

## 5. Backlog técnico

- Reducir tamaño y complejidad de Client Components grandes.
- Extraer lógica repetida de selección de academia.
- Centralizar validación de permisos en helpers server-side.
- Tipar de forma más estricta payloads de APIs.
- Mejorar cobertura de tests para flujos críticos:
  - saldo de planes
  - asistencia
  - cancelaciones
  - usuario activo/inactivo
  - billing y comisiones
- Completar `docs/architecture/03-data-model.md`.
- Revisar compatibilidad entre versiones Capacitor root (`@capacitor/*` v8 en root) y `mobile` (`@capacitor/*` v6).

## 6. Features futuras ya especificadas

### Bancard multi-merchant
Referencia: `docs/mobile-pagos-bancard-multimerchant.md`.

MVP definido:
- Alumno compra plan desde mobile.
- Cada academia cobra con sus credenciales.
- Checkout embebido vía WebView.
- Confirmación backend por webhook/callback.
- Acreditación idempotente.

### Importación masiva mejorada
Referencia: `docs/bulk-import-improvements.md`.

Ideas:
- Alias de academias.
- Plantilla CSV.
- Errores más específicos.
- Historial/log de importaciones.
- Reintento parcial.

### Reportes avanzados
Referencia: `docs/reports-and-coach-fees-improvements.md`.

Ideas:
- Margen por profesor.
- Filtros sede/cancha.
- Rangos rápidos.
- Cards resumen.
- Historial de tarifas.

## 7. Criterio de avance

Un feature se considera cerrado cuando:
- Tiene permisos server-side validados.
- Respeta multi-academia.
- Respeta `user_academies.is_active`.
- No rompe PWA/mobile.
- Actualiza `plan_usages`, `bookings`, `attendance` o billing de forma consistente si aplica.
- Incluye QA manual o validación técnica documentada.
- Actualiza `PROJECT_CONTEXT` si cambia arquitectura, reglas o roadmap.
