# DB changes playbook (Supabase)

Este playbook define el flujo operativo para mantener **la base Supabase**, las **migraciones**, y la **documentación** siempre sincronizadas.

## Fuente de verdad

- `supabase/migrations/` (migraciones generadas por `supabase db pull`)
- Snapshot consultable: `docs/db/schema.sql`
- Documentación humana: `docs/architecture/03-data-model.md`

## Requisitos

- Supabase CLI (en este repo se usa vía `npx supabase ...`)
- Docker corriendo (para `db pull` en modo estándar)
- Secret/variable local `SUPABASE_DB_URL` (NO commitear)

## Flujo diario (cuando cambia la DB)

## Checklist (owner) — qué hacer cada vez que cambies la DB en Supabase

Este checklist asume que **vos sos la única persona** que hace cambios en Supabase. El objetivo es que el repo siempre quede “source of truth” y que CI detecte drift.

### 0) Antes de tocar Supabase

1) Confirmar en qué rama vas a trabajar (recomendado: una branch por cambio)
2) Tener a mano la conexión (NO commitear)

- En local: exportar `SUPABASE_DB_URL` solo en tu terminal
- En GitHub: actualizar `secrets.SUPABASE_DB_URL` si rotaste password

### 1) Hacer el cambio en Supabase (UI o SQL Editor)

Ejemplos:

- Crear/alterar tabla
- Agregar columna/default/constraint
- Crear/alterar RLS policies
- Crear/alterar funciones/RPC

### 2) Sincronizar el schema al repo (obligatorio)

En la raíz del repo:

```bash
export SUPABASE_DB_URL='postgresql://...'
npm run db:schema:pull
```

Resultado esperado:

- Se crea un archivo nuevo en `supabase/migrations/<timestamp>_remote_schema.sql` (o similar)

### 3) Verificar que no quedó drift (recomendado)

```bash
npm run db:schema:check
```

Si falla, revisá `git status` y asegurate de commitear los cambios generados.

### 4) Actualizar documentación humana (obligatorio si cambia el modelo)

Actualizar:

- `docs/architecture/03-data-model.md`

Regla:

- Si tocaste tablas/columnas/FKs/constraints/vistas/RPC relevantes para el negocio, se actualiza el doc.

### 5) (Opcional) Snapshot consultable

Si mantenés el snapshot como include (actual):

- `docs/db/schema.sql` ya referencia `supabase/schema.sql`.

Si preferís snapshot autocontenido:

- copiar el contenido del último `supabase/migrations/<...>.sql` dentro de `docs/db/schema.sql`.

### 6) Commit + push

Archivos típicos a commitear:

- `supabase/migrations/*.sql`
- `docs/architecture/03-data-model.md` (si aplica)

Luego:

```bash
git status
git add supabase/migrations docs/architecture/03-data-model.md
git commit -m "chore(db): sync schema"
git push
```

### 7) Validar en CI

En GitHub:

- Verificar que el workflow **Supabase Schema Guard** quedó en verde.
- Si falla por drift, repetir desde el paso 2 y commitear lo faltante.

### 8) Si rotaste la DB password

1) Actualizar tu variable local `SUPABASE_DB_URL` (en tu terminal)
2) Actualizar `secrets.SUPABASE_DB_URL` en GitHub
3) Re-ejecutar el workflow manual para confirmar que sigue en verde

1) Hacer el cambio en Supabase (SQL Editor / UI)
2) Traer el esquema al repo

```bash
export SUPABASE_DB_URL='postgresql://...'
npm run db:schema:pull
```

3) Revisar qué cambió

- `supabase/migrations/*_remote_schema.sql` (o `_baseline_*.sql`)

4) Actualizar documentación humana si aplica

- `docs/architecture/03-data-model.md`

5) Commit + push

La CI (workflow `supabase-schema-guard`) debe quedar en verde.

## Convenciones

- No pegar URLs con password en docs.
- Si el password tiene caracteres especiales, usar una variable de entorno (evitar meterlo en el comando literal).

## Troubleshooting

- Si falla por IPv6: usar el pooler IPv4 o un host accesible desde tu red.
- Si aparece un prompt de reparación de historial: en CI se responde “no” y se falla para evitar mutar el remoto.
