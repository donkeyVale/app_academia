# Mejoras futuras: Importación masiva de usuarios

Este documento recopila ideas y sugerencias de mejoras relacionadas con la funcionalidad de **importación masiva de usuarios desde CSV** en la página de **Usuarios**.

## Estado actual (Resumido)

- Endpoint: `POST /api/admin/import-users`.
- UI: sección "Importar usuarios desde CSV" dentro del acordeón "Crear y gestionar usuarios" (solo `super_admin`).
- CSV esperado (encabezados en la primera fila):
  - `nombre`
  - `apellido`
  - `numero_de_documento`
  - `telefono`
  - `correo`
  - `fecha_de_nacimiento` (formato `DD/MM/YYYY`)
  - `role` (`admin`, `coach`, `student`)
  - `academias` (uno o varios UUID de academia separados por `;`).
- Backend:
  - Valida campos obligatorios, roles válidos, academias existentes y duplicados de documento/teléfono/correo (tanto en la base como dentro del mismo archivo).
  - Crea usuarios en Supabase Auth + `profiles` + `user_roles` + `students` (si corresponde) + `user_academies` (multiacademia).
  - Envía el **mismo correo de bienvenida** que el alta manual por cada usuario importado correctamente.
- Frontend:
  - Selector de archivo CSV con botón estilizado y texto de nombre de archivo.
  - Botón "Procesar archivo".
  - Resumen de resultados (total filas, usuarios creados, errores).
  - Tabla por fila con estado `OK` / `Error` y mensaje de detalle.
  - Botón "Limpiar resultados" con ícono `Trash2` que resetea archivo, resumen y tabla.

## Ideas de mejoras futuras

### 1. Alias de academias en el CSV

**Motivación:**
- Hoy el campo `academias` requiere UUIDs, lo cual es poco amigable para las academias que cargan datos en Google Sheets.

**Idea:**
- Permitir que el CSV use un alias más legible por cada academia (por ejemplo:
  - Código corto: `ACADEMIA_CENTRAL`, `SEDE_LUQUE`, etc.
  - O el nombre exacto de la academia).
- Mantener en base de datos una tabla de mapeo `academy_aliases` o reutilizar algún campo existente para alias/código.
- Durante la importación:
  - Interpretar el valor de `academias` como alias (o lista de alias separados por `;`).
  - Resolver cada alias a un `academy_id` real.
  - Reportar error claro si algún alias no existe o está duplicado.

### 2. Descarga de plantilla CSV

**Motivación:**
- Evitar errores de encabezados o formatos al armar el archivo en Google Sheets.

**Idea:**
- Agregar un botón en la sección de importación:
  - "Descargar plantilla CSV".
- La plantilla incluiría:
  - Fila de encabezados correcta.
  - Algunas filas de ejemplo comentadas o con datos ficticios.
- Implementación posible:
  - Endpoint `GET /api/admin/import-users/template` que devuelva un CSV generado al vuelo.
  - O archivo estático en `public/templates/users-import-template.csv`.

### 3. Mensajes de error más específicos

**Motivación:**
- Hoy se muestra un mensaje por fila, pero se puede hacer aún más claro para ciertos casos comunes.

**Ideas:**
- Distinguir entre:
  - Duplicado por documento.
  - Duplicado por teléfono.
  - Duplicado por correo.
  - Academia inexistente.
  - Rol inválido.
  - Faltan campos obligatorios.
- Incluir en el mensaje sugerencias de corrección (por ejemplo: "Verificá que el número de documento no esté ya cargado en el sistema").

### 4. Historial / log de importaciones

**Motivación:**
- Tener trazabilidad de quién importó qué y cuándo.

**Idea:**
- Tabla `user_import_logs` (o similar) con campos como:
  - `id`, `created_at`, `performed_by_user_id`.
  - Cantidad de filas totales, cantidad de filas OK, cantidad de filas con error.
  - Nombre original del archivo.
- UI sencilla (puede ser un listado minimal en la misma página o en otra sección super_admin) con:
  - Fecha y hora.
  - Usuario que hizo la importación.
  - Totales.

### 5. Mejoras de UX adicionales

- Mostrar un spinner o estado "Procesando archivo..." no solo en el botón, sino también como texto cerca de la tabla cuando la importación puede demorar.
- Limitar tamaño máximo del archivo CSV (ej: con mensaje anticipado si supera cierto umbral).
- Mostrar un pequeño aviso de "No cierres esta pestaña mientras se procesan los usuarios" para evitar confusiones.

---

Este documento sirve como referencia de mejoras futuras. Cuando se implementen cambios, se puede actualizar este archivo marcando qué puntos ya fueron abordados, o linkeando a los PRs / commits correspondientes.
