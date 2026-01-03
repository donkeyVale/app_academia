# Manual de Usuario — Administrador (Agendo)

Este manual describe el uso del sistema **Agendo** para el rol **Administrador** (incluye `admin` y `super_admin`, indicando diferencias cuando aplica). El foco es operar la plataforma en el día a día: agenda, alumnos, planes/pagos, reportes, configuración y usuarios.

---

## 1) Acceso al sistema

### 1.1 Ingreso

- Ingresá con tu **correo** y **contraseña**.
- Si tu usuario fue creado por la academia, la contraseña inicial suele ser tu **número de documento**.

### 1.2 Cerrar sesión

- Desde el menú del avatar: **Cerrar sesión**.

---

## 2) Conceptos clave

### 2.1 Roles

- **Admin**: gestiona la academia asignada (alumnos, finanzas, agenda, reportes, configuración de la academia).
- **Super admin**: administración global (además puede gestionar academias/sedes y asignaciones de roles por academia).

### 2.2 Multi-academia (Academia activa)

- Si tu usuario está asignado a más de una academia, la app mantiene una **academia activa** (guardada en `localStorage` como `selectedAcademyId`).
- Gran parte de los listados y operaciones (alumnos, finanzas, reportes, agenda) dependen de esa academia activa.

### 2.3 Notificaciones push

- Las notificaciones push requieren:
  - Permisos del navegador.
  - Suscripción en `push_subscriptions`.
  - `profiles.notifications_enabled != false`.
- Se pueden activar/desactivar desde **Configuración**.

---

## 3) Navegación principal (Administrador)

El menú principal del admin incluye:

- **Agenda** (`/schedule`)
- **Alumnos** (`/students`)
- **Finanzas** (`/finance`)
- **Reportes** (`/reports`)
- **Configuración** (`/settings`)
- **Usuarios** (`/users`) *(solo admin/super_admin)*

Además:

- **Mi perfil** (`/profile`)

---

## 4) Panel / Inicio

### 4.1 Inicio

- Muestra métricas de la academia activa (cuando aplica):
  - planes activos
  - alumnos con plan
  - clases del día
  - cantidad de profesores y alumnos

---

## 5) Agenda (`/schedule`)

La Agenda permite:

- Ver clases cargadas (ventana amplia: últimas 24h y próximos ~90 días).
- Filtrar por:
  - sede (location)
  - cancha
  - profesor
  - alumno
  - rango de fechas

### 5.1 Crear una clase

Flujo típico:

1. Elegí **Fecha** (`day`).
2. Seleccioná **Sede** y **Cancha**.
3. Elegí **Hora**.
   - Si NO usás recurrencia: se elige una hora única.
   - Si usás recurrencia: la hora se define por día de semana (ver 5.2).
4. Seleccioná **Profesor**.
5. Seleccioná **Alumno/s**.
   - El tipo se deriva automáticamente:
     - 1 alumno = `individual`
     - 2 a 4 alumnos = `grupal`
   - La capacidad se deriva de la cantidad de alumnos.
6. Opcional: notas.
7. Guardar.

Validaciones importantes:

- Se evita asignar una clase en un horario ya ocupado por otra clase en la misma cancha.
- Se valida que un alumno no tenga otra clase en el mismo horario.
- Puede limitarse la cantidad de reservas futuras de un alumno según clases de su plan.

### 5.2 Clases recurrentes

- Permite crear automáticamente una serie de clases futuras **hasta agotar el plan** de los alumnos seleccionados.
- Se definen:
  - días de la semana
  - **hora por cada día de la semana** (ej.: Lunes 06:00, Viernes 18:00)

Comportamiento:

- Se crea siempre la primera clase en la fecha seleccionada.
- Luego se intentan crear clases futuras en los días marcados.
- En clases grupales, la recurrencia sigue una lógica “variable por alumno”:
  - Si un alumno se queda sin saldo antes que otro, las clases posteriores se crean igual, pero con reservas solo para el/los alumnos que aún tengan saldo.

Conflictos y validaciones:

- Si la **cancha** ya está ocupada en una fecha/hora candidata, esa ocurrencia se omite y se busca la próxima.
- Si un **alumno** ya tiene otra clase en ese horario, esa ocurrencia se omite y se busca la próxima.
- Si el **profesor** ya tiene otra clase en ese horario, se muestra una advertencia (toast) pero no se bloquea.

Al finalizar, la app muestra un **toast resumen** con:

- cantidad de clases creadas
- reservas creadas por alumno
- cantidad de fechas omitidas (por cancha ocupada / alumnos ocupados)

### 5.3 Editar / reprogramar / cancelar

- Se puede editar una clase, reprogramar, o cancelar.
- Al cancelar o reprogramar pueden dispararse notificaciones push (si están habilitadas).

### 5.4 Asistencia

- La agenda maneja asistencia a través de `attendance`.
- Se registra presencia/ausencia por alumno.

---

## 6) Alumnos (`/students`)

Como admin, esta pantalla es la vista central de:

- listado de alumnos (solo de la academia activa)
- plan vigente y métricas (clases usadas/restantes)
- pagos recientes (cuando aplica)
- historial de clases/asistencia
- notas

Funciones destacadas:

### 6.1 Buscar alumnos

- Buscador por nombre/ID.

### 6.2 Ver plan y saldo

- El sistema calcula:
  - total de clases
  - clases usadas (`plan_usages`)
  - clases restantes reales
  - total pagado y saldo pendiente (según pagos `pagado`)

### 6.3 Historial del alumno

- Consulta clases del alumno, sede/cancha, profesor y si consumió plan.

### 6.4 Notas

- Se manejan notas asociadas a clases.

---

## 7) Finanzas (`/finance`)

Como admin, esta sección permite:

- Crear planes
- Asignar planes a alumnos
- Registrar pagos
- Ver pagos, saldo y estado
- Generar reportes internos por alumno

La UI está implementada mayormente en `PlansClient`.

### 7.1 Crear plan

- Cargar:
  - nombre
  - clases incluidas
  - precio

### 7.2 Asignar plan a alumno

- Seleccionar alumno
- Seleccionar plan
- Ajustar clases (si aplica)
- Aplicar descuento:
  - ninguno
  - porcentaje
  - monto

### 7.3 Registrar pago

- Seleccionar alumno
- Seleccionar plan
- Cargar:
  - monto
  - fecha
  - método
  - estado (`pagado` / `pendiente`)
  - notas

Notificaciones:

- Puede disparar push al alumno (pago registrado) y a admins (pago registrado).

---

## 8) Reportes (`/reports`)

Disponible para admin/super_admin.

Incluye:

- Reporte de ingresos (pagos)
- Resúmenes por alumno
- Resúmenes por plan
- Reportes de asistencia (por alumno)
- Reportes por profesor (clases y ausencias)
- Reportes por sede/cancha
- Exportaciones (Excel/PDF, según UI)

Flujo general:

1. Elegir rango de fechas.
2. Seleccionar filtros (si aplica).
3. Ver gráficos/tablas.
4. Descargar.

---

## 9) Configuración (`/settings`)

### 9.1 Notificaciones

- Activar/desactivar notificaciones push (`profiles.notifications_enabled`).

### 9.2 Academia activa

- Seleccionar academia activa (si tenés más de una asignada).

### 9.3 Configuración de alquiler / rent (solo admin/super_admin)

- Configurar `rent_mode` de la academia:
  - `per_student`
  - `per_hour`
  - `both`

- Configurar tarifas por:
  - sede (`locations`)
  - cancha (`courts`)

- Para `per_student` se manejan bandas horarias con `valid_from`.
- Para `per_hour` se manejan valores por clase/hora.

---

## 10) Usuarios (`/users`)

Disponible para admin y super_admin.

Permite:

### 10.1 Crear usuario

- Cargar:
  - nombre / apellido
  - documento
  - teléfono
  - correo
  - fecha de nacimiento
  - roles (puede ser múltiple)

Comportamiento:

- Crea usuario en Auth con contraseña inicial = documento.
- Crea `profiles` y `user_roles`.
- Si incluye rol `coach`: asegura registro en `coaches`.
- Si incluye rol `student`: asegura registro en `students`.

### 10.2 Importación masiva (CSV)

- Subir CSV con columnas esperadas (según UI) incluyendo fecha de nacimiento.
- Valida duplicados (email, teléfono, documento) y academias.
- Crea usuarios y asignaciones.

### 10.3 Buscar y filtrar usuarios

- Por texto
- Por academia
- Por estado (activo/inactivo)

### 10.4 Editar usuario

- Edita metadata (nombre, documento, teléfono, fecha de nacimiento, correo)
- Edita roles
- Permite marcar usuario **activo/inactivo** por academia.

### 10.5 Eliminar usuario

- Elimina un usuario (acción sensible; usar solo cuando corresponda).

---

## 11) Perfil (`/profile`)

- Editar datos personales (nombre, documento, teléfono, fecha nacimiento)
- Actualizar avatar
- Cambiar contraseña

---

## 12) Notificaciones automáticas (referencia)

La app envía notificaciones automáticas (según configuración):

- Eventos de clase: creada / cancelada / reprogramada
- Recordatorios de clase (hoy / mañana)
- Finanzas: pago pendiente, saldo pendiente, pago registrado
- Cumpleaños: alumno (en su día) y aviso a admins (mañana)

Para detalle técnico ver `docs/notificaciones-push.md`.

---

## Manual separado para Super Admin

El rol `super_admin` tiene operaciones globales (academias, sedes/canchas, asignaciones por academia). Ver el manual:

- `docs/manual-super-admin.md`
