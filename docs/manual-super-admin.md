# Manual de Usuario — Super Admin (Agendo)

Este manual describe el uso del sistema **Agendo** para el rol **Super Admin** (`super_admin`). Este rol tiene acceso global para:

- Crear y administrar **academias**.
- Administrar **sedes y canchas**.
- Asignar **usuarios a academias** con roles específicos (incluye multi-rol por academia).

> Para tareas operativas del día a día de una academia (agenda, alumnos, finanzas, reportes), ver también `docs/manual-admin.md`.

---

## 1) Acceso

- Ingresá con tu correo y contraseña.
- Podés cerrar sesión desde el menú del avatar.

---

## 2) Conceptos clave

### 2.1 Diferencia entre `super_admin` y `admin`

- **Super Admin**: administración global del sistema (puede crear academias y sedes, y controlar asignaciones).
- **Admin**: administración operativa dentro de academias asignadas.

### 2.2 Multi-rol y multi-academia

- Un mismo usuario puede estar asignado a múltiples academias.
- Un mismo usuario puede tener múltiples roles dentro de una misma academia (por ejemplo: `admin` + `coach`).
- La pertenencia y el rol por academia se guardan en `user_academies`.

### 2.3 Usuario activo/inactivo por academia

- En `user_academies` existe el flag `is_active`.
- Un usuario **inactivo** en una academia no debe operar ni recibir notificaciones de esa academia.

---

## 3) Navegación del Super Admin

Flujos principales del super admin:

- **Academias**: `/super-admin/academias`
- **Sedes y canchas**: `/super-admin/locations`
- **Asignaciones de academias por usuario**: `/super-admin/asignaciones`

Además, un super admin también puede:

- Usar funcionalidades de admin (agenda, alumnos, finanzas, reportes) cuando corresponda.
- Acceder a **Usuarios** (`/users`) para crear/editar usuarios.

---

## 4) Academias (`/super-admin/academias`)

### 4.1 Ver academias

- Se muestra un listado de academias existentes.

### 4.2 Crear academia

1. Escribí el **nombre**.
2. Presioná **Crear academia**.

Notas:

- El `slug` puede generarse automáticamente (según configuración de la DB).

---

## 5) Sedes y canchas (`/super-admin/locations`)

Esta pantalla administra:

- Sedes (tabla `locations`).
- Canchas (tabla `courts`) asociadas a una sede.
- Relación sede ↔ academia (tabla `academy_locations`).

### 5.1 Crear sede

1. En “Nueva sede”, ingresar nombre.
2. Crear.

### 5.2 Seleccionar sede

- Seleccioná una sede para:
  - ver sus canchas
  - crear canchas
  - vincular a academias

### 5.3 Crear cancha

1. Seleccionar sede.
2. Ingresar nombre de cancha.
3. Crear.

### 5.4 Vincular sede a academia

1. Seleccionar sede.
2. Elegir academia en el selector.
3. Vincular.

### 5.5 Desvincular sede de academia

- En la lista de vínculos, eliminar el vínculo correspondiente.

---

## 6) Asignaciones (`/super-admin/asignaciones`)

Esta pantalla permite:

- Seleccionar un usuario.
- Asignarle una academia y un rol dentro de esa academia.
- Quitar asignaciones.

### 6.1 Seleccionar usuario

- Usá el buscador para filtrar por nombre, rol o ID.

### 6.2 Asignar academia y rol

1. Seleccionar usuario.
2. Seleccionar **academia**.
3. Seleccionar **rol** (`admin`, `coach` o `student`).
4. Guardar.

Notas:

- Se permite asignar múltiples roles dentro de la misma academia.
- No se permite duplicar exactamente la tupla `(academy_id, role)` para el mismo usuario.

### 6.3 Quitar asignación

- Eliminar una asignación elimina una fila en `user_academies`.

---

## 7) Usuarios (`/users`) (opcional, pero frecuente)

Aunque el flujo “core” del super admin está en `/super-admin/*`, en la práctica suele usar `/users` para:

- crear usuarios
- editar roles
- activar/desactivar usuarios por academia

Para detalle de operación ver `docs/manual-admin.md` (sección Usuarios).

---

## 8) Checklist de puesta en marcha (nueva academia)

Flujo recomendado:

1. Crear academia (`/super-admin/academias`).
2. Crear sedes y canchas (`/super-admin/locations`).
3. Vincular sedes ↔ academia (`academy_locations`).
4. Crear usuarios base (admin, coaches, students) (`/users`).
5. Asignar usuarios a la academia con roles (`/super-admin/asignaciones`).
6. Validar en la app:
   - selección de academia activa
   - agenda
   - alumnos
   - finanzas
   - reportes

---

## 9) Notificaciones y seguridad (referencia)

- Las notificaciones push dependen de:
  - permisos del navegador
  - suscripciones
  - `profiles.notifications_enabled`
  - asignación activa `user_academies.is_active=true`

Para detalle técnico ver `docs/notificaciones-push.md`.
