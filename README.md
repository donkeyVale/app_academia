# App Academia

Aplicación de gestión multi-academia (Next.js + Supabase) para:
- agenda de clases
- alumnos/planes/pagos
- reportes (ingresos/egresos)
- administración de usuarios y roles

## Stack
- Next.js (App Router)
- TypeScript
- Supabase (Auth + DB)
- UI: shadcn/ui (componentes) + Tailwind

## Scripts
```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Variables de entorno
Configurar en `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (solo server)

## Roles y multi-academia
- Los roles principales viven en `profiles.role`.
- Roles adicionales viven en `user_roles`.
- Relación usuario <-> academia vive en `user_academies`.
- Estado activo/inactivo por academia: `user_academies.is_active`.
- El rol `super_admin` tiene acceso global (no depende de `user_academies`).

## Documentación
- Notas de release: `docs/release-notes-2025-12-28.md`
- Estructura DB (snapshot): `docs/db-estructura-28-12-2025.md`
