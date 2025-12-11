# Mejoras futuras: Reportes y tarifas de profesores

Este documento recopila ideas y sugerencias de mejoras relacionadas con:

- Reportes de ingresos, egresos y ganancia neta.
- Gestión de tarifas por profesor y academia.

La idea es usarlas como backlog para futuras iteraciones.

---

## 1. Reportes

### 1.1. Margen por profesor (ingreso estimado vs egreso)

**Motivación:**
- Hoy se calcula el total de ingresos del período (global) y los egresos por profesor.
- Sería muy útil ver, por profesor, una estimación de ingresos asociados y su margen.

**Idea:**
- Calcular, por profesor y período:
  - Ingreso estimado.
  - Egreso (ya disponible con `coachExpenses`).
  - Margen (ingreso estimado - egreso).
- Mostrarlo en una nueva sección/accordion "Margen por profesor" con:
  - Tabla por profesor.
  - Gráfico de barras agrupadas (ingreso vs egreso) o margen.

**Notas técnicas (posibles enfoques):**
- Aproximar ingresos por profesor prorrateando los pagos del período según:
  - Asistencia de alumnos a clases de ese profesor.
  - O porcentaje configurable de ingresos.
- Mantener la lógica de multi-academia.

---

### 1.2. Filtros más finos en egresos (academia / sede / cancha)

**Motivación:**
- Actualmente, los egresos por profesor usan la academia seleccionada y las sedes asociadas, pero no se puede filtrar por sede o cancha individual.

**Idea:**
- Agregar filtros opcionales en el acordeón de egresos:
  - Dropdown de sede (location) y/o cancha (court).
- Calcular egresos solo para las clases que cumplan esos filtros.

**Beneficio:**
- Poder analizar la rentabilidad de profesores por sede o por cancha.

---

### 1.3. Rangos rápidos de fecha

**Motivación:**
- Hoy el usuario debe elegir manualmente `Desde` y `Hasta` para ver ingresos/egresos.

**Idea:**
- Agregar botones de rangos rápidos:
  - "Este mes".
  - "Mes pasado".
  - "Últimos 30 días".
- Aplicar tanto al bloque de **Ingresos** como al de **Egresos** (comparten rango).

---

### 1.4. Indicadores rápidos al inicio

**Motivación:**
- En la vista de Reportes, los totales están dentro de cada acordeón.
- Un resumen global arriba ayudaría a entender de un vistazo la situación.

**Idea:**
- Agregar, al inicio de `ReportsPage`, un pequeño bloque de cards con:
  - Ingresos totales en el período seleccionado.
  - Egresos totales a profesores en el período.
  - Ganancia neta (ingresos - egresos).

**Notas:**
- Reutilizar valores ya calculados: `totalAmount` y `coachExpensesTotal`.

---

### 1.5. Recordar filtros y acordeones abiertos por usuario

**Motivación:**
- Cada vez que el usuario entra a Reportes, tiene que volver a abrir los acordeones y configurar fechas.

**Idea:**
- Guardar en `localStorage` o en una tabla de preferencias de usuario:
  - Último rango de fechas usado.
  - Qué acordeones estaban abiertos.
- Restaurar ese estado al volver a la página.

---

### 1.6. Modo compacto para móviles

**Motivación:**
- En pantallas pequeñas, los gráficos pueden ocupar mucho espacio y ralentizar la lectura.

**Idea:**
- Añadir un "modo compacto" o un comportamiento automático en mobile:
  - Ocultar (o colapsar) algunos gráficos, mostrando primero los totales y tablas simples.
  - Dejar un botón para desplegar los gráficos cuando el usuario los necesite.

---

## 2. Tarifas de profesores (coach fees)

### 2.1. Historial de cambios de tarifa

**Motivación:**
- Hoy se guarda la tarifa actual por profesor y academia, pero no hay rastro de cambios.

**Idea:**
- Crear un historial de cambios de tarifa, por ejemplo:
  - Tabla `coach_fee_history` o similar.
  - Campos sugeridos: `id`, `coach_id`, `academy_id`, `old_fee`, `new_fee`, `changed_by`, `changed_at`.
- En el modal de detalle de profesor (UsersPage):
  - Acordeón "Historial de tarifa" con los últimos N cambios.

**Beneficio:**
- Transparencia ante profesores y admins.
- Auditoría básica de ajustes de costos.

---

### 2.2. Tarifas por tipo de clase

**Motivación:**
- Algunas academias pagan distinto según el tipo de clase (grupal, individual, etc.).

**Idea:**
- Extender el modelo de tarifas para que pueda depender de:
  - Tipo de clase (por ejemplo, `class_type`: grupal, individual, partido, etc.).
  - Opcionalmente, duración distinta a la estándar.
- Ejemplo de estructura:
  - `coach_id`, `academy_id`, `class_type`, `fee_per_class`, `currency`, timestamps.

**Impacto en reportes:**
- El cálculo de egresos tendría en cuenta el tipo de clase de cada `class_session` para elegir la tarifa correcta.

---

## 3. Importación masiva (ideas complementarias)

> Nota: la mayoría de las mejoras de importación masiva ya están documentadas en `docs/bulk-import-improvements.md`. Aquí se listan algunas adicionales que se relacionan con la operación diaria.

### 3.1. Plantilla CSV descargable y ejemplos

**Motivación:**
- Facilitar que las academias preparen sus archivos sin equivocarse con los encabezados.

**Idea:**
- Botón "Descargar plantilla CSV" en la sección de importación masiva.
- Incluir además un ejemplo con 2–3 filas de muestra.

---

### 3.2. Reintento parcial para filas con error

**Motivación:**
- Hoy, si un archivo tiene muchas filas, algunas pueden fallar por errores puntuales (datos inválidos, duplicados, etc.).

**Idea:**
- Agregar un botón "Exportar errores" que genere un CSV con:
  - Todas las columnas originales.
  - Una columna adicional `error` con el mensaje devuelto.
- El usuario puede corregir ese CSV y volver a importarlo.

---

## 4. Prioridades sugeridas

Orden sugerido para futuras iteraciones (puede ajustarse según necesidades reales):

1. **Margen por profesor (ingreso estimado vs egreso)**.
2. **Rangos rápidos de fecha** y **indicadores rápidos al inicio**.
3. **Historial de cambios de tarifa**.
4. **Filtros más finos en egresos (sede/cancha)**.
5. **Plantilla CSV y reintento parcial**.
6. **Recordar filtros / acordeones abiertos** y **modo compacto para móviles**.
