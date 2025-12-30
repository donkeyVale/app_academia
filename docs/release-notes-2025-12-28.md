# Release notes (28-12-2025)

Este documento resume lo implementado/ajustado en esta iteración.

## 1) Finanzas: egresos por alquiler de canchas

### Qué se agregó
- Se incorporó el egreso por **alquiler de cancha** dentro de los cálculos de finanzas.
- Se agregó el modo de cálculo configurable por academia `academies.rent_mode`:
  - `per_student`: alquiler por alumno por clase (bandas horarias)
  - `per_hour`: alquiler por clase (60 min)
  - `both`: suma ambos (útil para transición)
- Se contempla tarifa base por **sede (location)** y override por **cancha (court)**.
- Se contempla **vigencia** (histórico) de tarifas.

### Tablas involucradas
- Por hora (por clase):
  - `location_rent_fees` (tarifa por sede)
  - `court_rent_fees` (tarifa por cancha)
- Por alumno (bandas horarias):
  - `location_rent_fees_per_student`
  - `court_rent_fees_per_student`

### Reglas de cálculo (alto nivel)
- Para cada clase:
  - se filtra que exista al menos 1 booking
  - se calcula cantidad de alumnos usando `plan_usages` (alumnos consumiendo clase)
- Para tarifas por alumno:
  - se determina la banda horaria según horario local `America/Asuncion`
  - se intenta aplicar primero tarifa por cancha (override)
  - si no aplica, se usa la tarifa por sede
  - se usa la tarifa vigente para la fecha (`valid_from`/`valid_to`)
- Para tarifas por hora:
  - se mantiene el cálculo previo (por clase de 60 min) vía RPC.

### Impacto
- Reportes: egresos incluyen profesores + alquiler.
- Home (admin/super-admin): card “Ingresos vs egresos” incluye alquiler.

### Configuración (Settings)
- Nueva UI para configurar alquiler por alumno con bandas horarias:
  - presets (horas muertas / pico)
  - agregado manual de bandas
  - eliminación de bandas (persistente al guardar)
- Selector de modo `rent_mode`.

## 2) Reportes: mejoras de UI / export

### Cambios relevantes
- Se unificó el export de egresos para abarcar tanto:
  - egresos por profesor
  - egresos por alquiler de cancha
- Se ajustaron detalles de UI/UX para que el reporte sea más claro y con menos ruido visual.

### Export (Excel / PDF)
- Export unificado con:
  - nombres de archivos estándar (`Agendo - Reporte ... - desde a hasta`)
  - logo Agendo
  - Excel: freeze header, anchos automáticos, zebra rows
  - PDF: A4 portrait, header/footer en todas las páginas, paginado

## 3) Agenda (Schedule): clases recientes para asistencia

### Comportamiento
- Una clase pasa a “Clases recientes para asistencia” **cuando termina**.
- Permanece visible hasta **24 horas** si no se marcó asistencia.
- Si la asistencia se marca, la clase se oculta de la lista de recientes.

### Ajustes adicionales
- El acordeón “Clases recientes para asistencia” se renderiza **siempre** (para roles no-student).
  - Si no hay clases, se muestra estado vacío.
- Al entrar desde el Home por “Clases de hoy”, no se ocultan las clases de mañana.

## 4) Usuarios (super-admin): activo/inactivo por academia

### Objetivo
Permitir que el estado activo/inactivo sea **por academia**, ya que un usuario puede estar activo en una y no en otra.

### Implementación
- El estado se controla con `user_academies.is_active`.
- En la pantalla de usuarios (super-admin):
  - filtro por academia
  - filtro por estado (activo/inactivo) dependiente de la academia seleccionada
  - diferenciación visual de usuarios inactivos en esa academia
- En el modal de detalle:
  - selector de academia
  - switch para activar/inactivar la relación usuario+academia

### API
- `/api/admin/get-user`: devuelve academias del usuario con su `is_active`.
- `/api/admin/update-user`: permite actualizar `user_academies.is_active` con `academyId` + `academyIsActive`.

## 5) Acceso y selección de academia

### Usuarios no super-admin
- Se bloquea el acceso si el usuario no tiene ninguna academia activa.
- Si el usuario tenía seleccionada una academia inactiva, se lo redirige a una activa con mensaje.

### Super-admin
- El `super_admin` tiene acceso global:
  - no depende de `user_academies` para listar academias
  - no se bloquea por `is_active` de academias

## 6) Fixes técnicos

- Se agregó componente `Switch` en `src/components/ui/switch.tsx`.
- Se ajustó `tsconfig.json` agregando `baseUrl` para mejorar resolución del alias `@/*`.

## 8) Checklist de despliegue/migración (alto nivel)

- Aplicar migraciones SQL (tablas/columnas relacionadas a alquiler por alumno y `rent_mode`).
- Verificar que `academies.rent_mode` tenga default `per_student`.
- Validar cálculos contra DB con queries de verificación (ingresos, egresos por profesor, egresos por alquiler por alumno/por hora).
- `npm install` y `npm audit` sin vulnerabilidades.
- `npm run build` exitoso.

## 7) Infra / Planes (Supabase y Vercel)

- La cuenta/proyecto de **Supabase** está en plan **Pro** (ya no es Free).
- La cuenta/proyecto de **Vercel** está en plan **Pro** (ya no es Free).

> Nota: documentar internamente (fuera del repo si aplica) el motivo del upgrade, fecha exacta, owner de facturación y límites/alertas de costos.
