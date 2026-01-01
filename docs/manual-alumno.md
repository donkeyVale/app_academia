# Manual de Usuario — Alumno (Agendo)

Este manual describe el uso del sistema **Agendo** para el rol **Alumno** (`student`). Incluye agenda, “mi cuenta”, finanzas personales, configuración, perfil y notificaciones.

---

## 1) Acceso

- Ingresá con tu correo y contraseña.
- Si tu usuario fue creado por la academia, la contraseña inicial suele ser tu **número de documento**.

---

## 2) Navegación del Alumno

La navegación del alumno es compacta:

- **Agenda** (`/schedule`)
- **Mi cuenta** (`/students`) *(la app reutiliza la pantalla de alumnos como “Mi cuenta”)*
- **Finanzas** (`/finance`) *(solo vista de alumno)*
- **Configuración** (`/settings`)
- **Mi perfil** (`/profile`)

---

## 3) Inicio

El inicio muestra un resumen del alumno:

- cantidad de clases reservadas futuras
- clases restantes del plan actual

---

## 4) Agenda (`/schedule`)

### 4.1 Ver tus clases

- La agenda muestra clases y reservas.
- Para el alumno, se resuelve tu `studentId` a partir de `students.user_id`.

### 4.2 Reservas

- Tus reservas se registran en `bookings`.

---

## 5) Mi cuenta (`/students`)

Esta pantalla funciona como tu “centro” de información:

- tu plan vigente (clases restantes)
- pagos recientes
- historial (clases, asistencia)

Qué vas a ver:

- **Clases restantes**: se calcula como (clases totales del plan) - (usos en `plan_usages`).
- **Saldo pendiente**: según el total del plan y pagos con status `pagado`.

---

## 6) Finanzas (`/finance`)

Para el alumno, Finanzas es un panel de consulta:

- resumen del plan actual en la academia activa
- pagos recientes
- historial de movimientos/consumos (según UI)

Importante:

- El alumno ve su resumen filtrado por la **academia activa**.

---

## 7) Configuración (`/settings`)

### 7.1 Notificaciones

- Podés activar/desactivar notificaciones push.

### 7.2 Academia activa

- Si estás asignado a más de una academia, podés elegir la academia activa.

---

## 8) Perfil (`/profile`)

- Editar tus datos personales (nombre, teléfono, fecha de nacimiento)
- Cambiar contraseña
- Actualizar avatar

---

## 9) Notificaciones que puede recibir el alumno

Dependiendo de la configuración:

- clase creada / cancelada / reprogramada
- recordatorios de clase (hoy / mañana)
- pagos:
  - pago pendiente
  - saldo pendiente
  - pago registrado
- cumpleaños: “Feliz cumpleaños… de parte de AGENDO!!”

Para detalle ver `docs/notificaciones-push.md`.

---

## Manuales relacionados

- Operación de academia (admin): `docs/manual-admin.md`
- Administración global (super admin): `docs/manual-super-admin.md`
