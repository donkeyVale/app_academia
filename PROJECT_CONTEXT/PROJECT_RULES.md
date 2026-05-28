# PROJECT_RULES

## 1. Regla principal

Este proyecto ya tiene arquitectura, convenciones y flujos de negocio en producción o cerca de producción. Todo agente IA debe trabajar de forma incremental, respetando el sistema existente y evitando cambios amplios sin necesidad.

Antes de modificar código:
- Leer `PROJECT_CONTEXT/MASTER_CONTEXT.md`.
- Leer `PROJECT_CONTEXT/ROADMAP.md`.
- Revisar `PROJECT_CONTEXT/DECISIONS_LOG.md`.
- Revisar docs específicos del módulo en `docs/`.
- Inspeccionar el código real antes de asumir comportamiento.

## 2. Alcance y seguridad de cambios

- No modificar lógica funcional cuando la tarea sea solo documentación.
- No refactorizar módulos grandes como parte de cambios pequeños.
- No reordenar archivos, renombrar rutas o cambiar modelos sin motivo explícito.
- No tocar secretos, claves, URLs privadas ni `.env`.
- No revertir cambios existentes del usuario u otros agentes.
- Si aparece un worktree sucio, trabajar alrededor y documentar lo tocado.

## 3. Stack y estilo

- Usar Next.js App Router.
- Mantener TypeScript.
- Mantener componentes funcionales React.
- Reutilizar helpers existentes en `src/lib`.
- Reutilizar UI existente en `src/components/ui`.
- Usar `lucide-react` cuando se necesiten iconos nuevos.
- Mantener Tailwind y patrones visuales existentes.
- Evitar dependencias nuevas salvo necesidad clara.

## 4. Rutas y arquitectura

- Rutas autenticadas viven bajo `src/app/(dashboard)`.
- Rutas públicas viven bajo `src/app/(auth)`, `privacy-policy`, `support` u otras explícitamente excluidas en middleware.
- APIs viven bajo `src/app/api/*/route.ts`.
- Código reusable debe ir en `src/lib` o `src/components` solo si se comparte realmente.
- No duplicar clientes Supabase: usar `createClientBrowser`, `createClientServer` o `supabaseAdmin` según contexto.

## 5. Auth, roles y permisos

Roles existentes:
- `super_admin`
- `admin`
- `coach`
- `student`

Reglas:
- `profiles.role` es el rol principal.
- `user_roles` contiene roles adicionales.
- `user_academies` gobierna acceso por academia.
- `user_academies.is_active=false` debe impedir operación y notificaciones para esa academia.
- `super_admin` tiene acceso global, pero no debe saltarse reglas de negocio accidentalmente.
- La UI puede usar `localStorage`, pero la autorización real debe validarse server-side.
- Cualquier endpoint con `supabaseAdmin` debe verificar `currentUserId`, rol y academia cuando aplique.

## 6. Multi-academia

- `selectedAcademyId` en `localStorage` define la academia activa en UI.
- Cambios de academia deben emitir/escuchar `selectedAcademyIdChanged` si impactan pantallas abiertas.
- En módulos operativos, filtrar siempre por academia activa o academia efectiva.
- Para `super_admin` impersonando, usar `impersonateAcademyId` como academia efectiva y tratar el rol UI como `admin`.
- No mostrar ni operar datos cross-academy a roles no globales.

## 7. Base de datos

Fuente de verdad:
- `supabase/migrations/`
- `docs/db-changes-playbook.md`

Reglas:
- No cambiar schema sin migración.
- No editar snapshots a mano si el cambio real viene de Supabase.
- Si cambia el modelo, actualizar documentación humana relevante.
- Mantener RLS en mente aunque un endpoint use service role.
- No crear tablas nuevas si una tabla existente resuelve el caso.
- Preservar constraints e índices de deduplicación, especialmente en notificaciones y `plan_usages`.

## 8. Agenda, calendario y saldo

- `/schedule` es el flujo clásico y referencia de paridad.
- `/calendar` usa FullCalendar y debe mantener coherencia con `/schedule`.
- Validar siempre conflictos de cancha y alumno.
- Conflicto de profesor puede ser warning según comportamiento actual.
- `plan_usages` es crítico para saldos:
  - crear reserva: `pending`
  - asistencia presente/confirmada: `confirmed`
  - cancelación/remoción: `refunded`
- No filtrar incorrectamente planes si rompe saldo real; revisar RPC `get_students_remaining_classes`.
- Cancelar clase debe limpiar/actualizar `bookings`, `attendance`, `plan_usages` y `class_sessions.status` según flujo existente.

## 9. Usuarios

- Alta manual e importación masiva deben crear usuarios activos por defecto.
- Actividad/inactividad se controla por academia con `user_academies.is_active`.
- `super_admin` puede cambiar estado directamente.
- `admin` solicita inactivación; no debe poder inactivar arbitrariamente si el flujo exige aprobación.
- Al cambiar roles, mantener sincronizados:
  - `profiles.role`
  - `user_roles`
  - `students`
  - `coaches`
  - `user_academies`
- Documentos sensibles como cédula deben consultarse por endpoints autorizados.

## 10. Notificaciones

- Antes de cambiar push, leer `docs/notificaciones-push.md`.
- Filtrar destinatarios por:
  - suscripción existente
  - `profiles.notifications_enabled != false`
  - academia del evento
  - `user_academies.is_active=true`
- Limpiar suscripciones inválidas con status `404` o `410`.
- Usar `notification_events` para anti-spam en crons.
- In-app notifications deben usar helper `createInAppNotifications`.
- OneSignal debe enviarse desde server con `sendOneSignalNotification`.
- Emails no deben romper el flujo si SMTP no está configurado, salvo que el producto lo exija.

## 11. Billing super-admin

- Solo `super_admin` debe operar billing global.
- Distinguir factura emitida (`billing_invoices`) de pago registrado (`billing_payments`).
- Las comisiones de vendedores se calculan sobre pagos reales registrados.
- Antes de tocar billing leer `docs/super-admin-billing-notifications-handoff.md`.
- Validar server-side permisos de endpoints de facturación y comisiones.

## 12. Mobile / PWA

- El web app es fuente de verdad.
- Capacitor debe cargar una URL web estable.
- Middleware debe permitir recursos públicos necesarios para stores y deep links.
- No romper:
  - `/privacy-policy`
  - `/support`
  - `/.well-known/*`
  - `/apple-app-site-association`
  - `manifest.json`
  - `sw.js`
- Para biometría, usar helpers existentes en `src/lib/capacitor-biometrics.ts`.

## 13. UI/UX

- Mantener estética AGENDO: fondos claros, acento `#3cadaf`, texto `#31435d`.
- Priorizar pantallas operativas densas y claras sobre layouts decorativos.
- No crear landing pages para módulos internos.
- En mobile, cuidar footer fijo, modales con acciones visibles y listas scrolleables.
- Los filtros largos deben usar búsqueda y contenedores con scroll.
- Evitar texto que se desborde en botones, tablas o chips.

## 14. Documentación persistente

Actualizar `PROJECT_CONTEXT` cuando:
- Se agregue una funcionalidad relevante.
- Cambie una decisión de arquitectura o negocio.
- Cambie el estado real del roadmap.
- Se detecte riesgo técnico importante.

Archivos:
- `MASTER_CONTEXT.md`: fotografía estable del proyecto.
- `PROJECT_RULES.md`: reglas que deben obedecer futuros agentes.
- `ROADMAP.md`: avance y prioridades.
- `DECISIONS_LOG.md`: decisiones fechadas y su impacto.
- `SESSION_HANDOFF.md`: usar al cerrar sesiones largas o dejar trabajo parcial.

## 15. Validación

Según el cambio:
- Ejecutar `npm run lint` para cambios TS/React si es viable.
- Ejecutar `npm run build` si el cambio toca rutas, APIs o configuración.
- Para DB, seguir `npm run db:schema:pull` y `npm run db:schema:check` cuando aplique.
- Para frontend visual, probar manualmente las rutas tocadas.
- Para notificaciones/crons, validar con payloads controlados y revisar anti-spam.

Si no se pudo validar, dejarlo explícito en la respuesta final y/o `SESSION_HANDOFF.md`.
