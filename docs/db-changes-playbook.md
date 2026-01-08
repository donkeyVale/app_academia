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
