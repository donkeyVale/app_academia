# Manual de Usuario — Profesor (Agendo)

Este manual describe el uso del sistema **Agendo** para el rol **Profesor** (`coach`). Incluye navegación, agenda, asistencia y gestión de alumnos vinculados a tus clases.

---

## 1) Acceso

- Ingresá con correo y contraseña.
- Podés cerrar sesión desde el menú del avatar.

---

## 2) Conceptos clave

### 2.1 Multi-academia (academia activa)

- Si estás asignado a más de una academia, el sistema utiliza una **academia activa**.
- La academia activa filtra sedes/canchas, agenda y el listado de alumnos que ves.

### 2.2 Notificaciones

- Podés activar/desactivar push desde **Configuración**.
- Recordatorios automáticos de clases pueden llegarte según la configuración general.

---

## 3) Navegación del Profesor

- **Agenda** (`/schedule`)
- **Alumnos** (`/students`) (por defecto en modo “mis alumnos”)
- **Configuración** (`/settings`)
- **Mi perfil** (`/profile`)

---

## 4) Inicio

En el inicio (Home) se muestran métricas del profesor:

- clases de hoy
- clases de la semana
- alumnos activos (alumnos con clases futuras reservadas con vos)

---

## 5) Agenda (`/schedule`)

La Agenda es tu herramienta principal.

### 5.1 Ver clases

- Vas a ver clases dentro de una ventana amplia de fechas.
- Podés filtrar por:
  - sede/cancha
  - profesor
  - alumno
  - rango de fechas

### 5.2 Alumnos por clase

- En cada clase, se muestra la lista de alumnos reservados.

### 5.3 Asistencia

- Se registra asistencia en `attendance`.
- Podés marcar presente/ausente según el flujo disponible en la pantalla.

### 5.4 Notas

- Se manejan notas asociadas a clases (según UI y permisos).

### 5.5 Clases recurrentes (creación)

- El profesor puede visualizar clases recurrentes creadas por admin/super admin.
- Cuando se crean clases recurrentes, se pueden definir:
  - días de la semana
  - **hora por cada día** (ej.: Lunes 06:00, Viernes 18:00)

Comportamiento relevante:

- Se crean múltiples clases futuras hasta agotar el plan del/los alumnos.
- En clases grupales, puede pasar que en algunas fechas haya menos alumnos, si alguno se quedó sin saldo antes.
- Si el profesor ya tiene una clase en el mismo horario, el sistema puede mostrar una advertencia, pero no bloquea la creación.

---

## 6) Alumnos (`/students`)

Para el profesor, la pantalla de alumnos se comporta de forma especial:

- Puede activar “**Solo mis alumnos**”: alumnos con clases futuras contigo.
- Respeta la **academia activa**:
  - se limita a alumnos que tengan plan en esa academia
  - y si tienen `user_id`, se valida que sigan asignados a la academia

Funciones:

### 6.1 Ver estado de plan / clases

- Se calcula:
  - clases usadas (por `plan_usages`)
  - clases restantes
  - saldo pendiente (según pagos)

### 6.2 Historial del alumno

- Podés consultar historial de clases y asistencia.

### 6.3 Notas

- Si está habilitado, podés ver/agregar notas asociadas a clases.

---

## 7) Configuración (`/settings`)

- Activar/desactivar notificaciones
- Seleccionar academia activa (si aplica)

---

## 8) Perfil (`/profile`)

- Editar datos personales
- Cambiar contraseña
- Cambiar avatar

---

## 9) Notificaciones relevantes para profesor

Según eventos del sistema, podés recibir push por:

- clase creada (cuando te asignan como profesor)
- clase cancelada / reprogramada
- recordatorios de clase

Para detalle ver `docs/notificaciones-push.md`.

---

## Manuales relacionados

- Operación de academia (admin): `docs/manual-admin.md`
- Administración global (super admin): `docs/manual-super-admin.md`
