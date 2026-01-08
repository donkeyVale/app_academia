# Supabase DB Documentation Kit (copiable a otros proyectos)

Este documento describe un proceso reproducible para:

- versionar el esquema de una base Supabase en Git (`supabase/migrations`),
- generar un snapshot consultable del esquema,
- mantener un documento humano de “modelo de datos”,
- y agregar un guard en GitHub Actions que falle si la DB cambió y el repo no fue actualizado.

El objetivo es que, revisando el repo (migraciones + snapshot + doc), puedas saber **exactamente** cómo está la base.

---

## 1.1) Template recomendado de estructura de documentación (copiar/pegar)

Sugerencia de carpetas/archivos dentro del repo:

```text
supabase/
  migrations/
    <timestamp>_remote_schema.sql

docs/
  architecture/
    01-overview.md
    02-auth-and-dashboard.md
    03-data-model.md
  db/
    schema.sql
  db-changes-playbook.md
  supabase-db-documentation-kit.md

.github/
  workflows/
    supabase-schema-guard.yml
```

Notas:

- `supabase/migrations/` es la fuente de verdad del esquema.
- `docs/db/schema.sql` es un “snapshot” para consulta rápida (opcional).
- `docs/architecture/03-data-model.md` es el doc humano (alto nivel).
- `docs/db-changes-playbook.md` es el procedimiento diario (operativo).
- `docs/supabase-db-documentation-kit.md` es esta guía (reutilizable).

Checklist de qué debe quedar commiteado:

- `supabase/migrations/*.sql`
- `docs/architecture/03-data-model.md` (si el cambio afecta tablas/columnas/FKs)
- `.github/workflows/supabase-schema-guard.yml`

Checklist de qué NO se commitea:

- URLs con passwords (ej. `SUPABASE_DB_URL`)
- `.env*` con secretos
- tokens de Supabase CLI

---

## 1) Convención: cuál es la “fuente de verdad”

- **Fuente de verdad del esquema**: `supabase/migrations/` (commiteado en git).
- **Snapshot de consulta rápida**: `docs/db/schema.sql` (opcional).
- **Documento humano (alto nivel)**: `docs/architecture/03-data-model.md` (o similar).

Regla práctica:

- Si cambias DB en Supabase (UI o SQL Editor), debes reflejarlo en `supabase/migrations` con `supabase db pull`.

---

## 2) Setup local (una vez por proyecto)

### 2.1 Instalar Supabase CLI

macOS (Homebrew):

```bash
brew install supabase/tap/supabase
supabase --version
```

### 2.2 Inicializar Supabase en el repo

En la raíz del proyecto:

```bash
supabase init
```

Eso crea el directorio `supabase/`.

### 2.3 Login y link del proyecto

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
```

Dónde obtener `<PROJECT_REF>`:

- Supabase Dashboard → Project Settings → General → Reference ID

---

## 3) Obtener conexión a la DB (importantísimo: IPv4 vs IPv6)

En algunos entornos, `db.<project-ref>.supabase.co` puede resolver a IPv6 y fallar con:

- `no route to host` (por falta de IPv6).

Solución:

- Usar **Session Pooler (IPv4)**.

En el dashboard suele aparecer como una URL parecida a:

```text
postgresql://postgres.<project-ref>:<PASSWORD>@aws-<region>.pooler.supabase.com:5432/postgres
```

Notas:

- NO commitear esta URL.
- NO pegarla en docs.
- Guardarla como secret.

---

## 4) Traer esquema remoto al repo (db pull)

### 4.1 Exportar variable local (solo en tu máquina)

```bash
export SUPABASE_DB_URL='postgresql://postgres.<project-ref>:<PASSWORD>@aws-<region>.pooler.supabase.com:5432/postgres'
```

### 4.2 Ejecutar db pull

Recomendado:

```bash
supabase db pull --db-url "$SUPABASE_DB_URL"
```

Esto genera un archivo nuevo tipo:

- `supabase/migrations/YYYYMMDDHHMMSS_remote_schema.sql`

---

## 5) Caso especial: historial de migraciones desalineado

Síntoma:

- `The remote database's migration history does not match local files`

Causa típica:

- `supabase/migrations/` está vacío o desincronizado con el historial remoto.

Solución:

1) Ver el estado:

```bash
supabase migration list
```

2) Si el CLI te da un ID y necesitas alinear el historial:

```bash
supabase migration repair --status applied <MIGRATION_ID>
```

Esto repara la tabla de historial para que el remoto reconozca ese ID.

---

## 6) Documentación del esquema

### 6.1 Snapshot consultable

Crea `docs/db/schema.sql`.

Opciones:

- Opción A (simple): que incluya el último `remote_schema.sql` (requiere cliente psql para interpretarlo):

```sql
-- Snapshot del esquema (source of truth)
\i ../supabase/migrations/<ULTIMO_REMOTE_SCHEMA>.sql
```

- Opción B (recomendada si querés que sea autocontenido): copiar/pegar el contenido del último `remote_schema.sql` en `docs/db/schema.sql`.

### 6.2 Documento humano (modelo de datos)

Mantener un doc tipo:

- `docs/architecture/03-data-model.md`

Incluye:

- tablas principales
- campos relevantes
- relaciones (FK)
- defaults importantes
- constraints únicas
- vistas/materializaciones relevantes

Regla:

- Cuando cambie el esquema (tablas/columnas/FKs), actualizar también este documento.

---

## 7) Guard automático en GitHub Actions (CI)

### 7.1 Crear workflow

Archivo:

- `.github/workflows/supabase-schema-guard.yml`

Comportamiento:

- corre en `pull_request` y `workflow_dispatch`
- ejecuta `supabase db pull` con `SUPABASE_DB_URL` (secret)
- falla si hay cambios no commiteados en `supabase/migrations`

### 7.2 Secret en GitHub

En el repo:

- Settings → Secrets and variables → Actions → Repository secrets

Crear:

- Name: `SUPABASE_DB_URL`
- Value: (solo la URL, sin `export`)

### 7.3 Nota sobre prompts y falsos fallos

En algunos entornos `supabase db pull` puede:

- preguntar por actualizar el historial remoto
- o devolver exit code != 0 aunque diga `No schema changes found`

Recomendación:

- No permitir prompts en CI.
- Tratar como éxito si el output contiene `No schema changes found`.

---

## 8) Workflow diario (operativo)

Cada vez que cambies DB en Supabase:

1) `supabase db pull` hacia `supabase/migrations`
2) commitear cambios en `supabase/migrations`
3) actualizar `docs/architecture/03-data-model.md` si el cambio afecta el modelo
4) push → CI debe quedar en verde

---

## 9) Checklist de seguridad

- Nunca pegar passwords en chats.
- Rotar credenciales si se exponen.
- Guardar `SUPABASE_DB_URL` como Secret en GitHub.
- Evitar `pull_request_target` si no sabes exactamente los riesgos.
