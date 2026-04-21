# Feature Handoff: Registro de Usuario (rama `feature/register`)

## Resumen funcional implementado

Se implementó un flujo nuevo de registro con estas decisiones de producto:

1. El acceso a registro inicia desde `/login` con botón/link **Registrarse** hacia `/register`.
2. Métodos de registro:
   - **Manual** (email + contraseña + datos personales obligatorios)
   - **OAuth Google**
   - **OAuth Apple**
3. Se reemplazó la propuesta previa de magic link por Apple.
4. La asociación de academia es por **Opción B: código de academia**.
5. El rol por defecto en auto-registro es **jugador** (`student`).
6. Si en OAuth faltan datos obligatorios, se obliga completar perfil en modal al entrar al Home.
7. Se envía correo de bienvenida al completar alta/perfil (con control para no reenviar múltiples veces en el flujo de perfil).

---

## Archivos nuevos

- `src/app/(auth)/register/page.tsx`
  - Pantalla de registro manual + social (Google/Apple).
  - Pide código de academia en social y lo persiste temporalmente para completar vinculación tras callback.

- `src/app/api/auth/register/route.ts`
  - Endpoint de auto-registro manual.
  - Crea usuario y entidades relacionadas con rol `student` por defecto.

- `src/app/api/auth/complete-profile/route.ts`
  - Endpoint de completar perfil post OAuth.
  - Ahora también asegura vinculación de academia/rol/alumno cuando llega `academyCode`.

- `docs/feature-register-v1-handoff.md`
  - Este documento de continuidad.

---

## Archivos modificados relevantes

- `src/app/(auth)/login/page.tsx`
  - Se agregó acceso visible a `/register`.

- `src/app/page.tsx`
  - Modal de completar perfil (teléfono, cédula, fecha nacimiento).
  - Se integra `academyCode` pendiente (query/localStorage) para completar asignación al volver de OAuth.

---

## Flujo Manual (estado actual)

1. Usuario entra a `/register` en modo manual.
2. Completa:
   - nombre
   - apellido
   - cédula
   - teléfono
   - fecha nacimiento
   - correo
   - contraseña
   - **código de academia**
3. Front llama `POST /api/auth/register`.
4. Backend valida:
   - campos obligatorios
   - código de academia (`academies.slug`)
   - academia no suspendida (`is_suspended = false`)
   - duplicados de teléfono y cédula
5. Backend crea:
   - auth user (con metadata)
   - `profiles` (`role = student`, `default_academy_id`)
   - `user_roles` con `student`
   - `user_academies` con `role = student`, `is_active = true`
   - `students`
6. Se envía welcome email.
7. Front redirige a `/login`.

---

## Flujo OAuth Google/Apple (estado actual)

1. Usuario entra a `/register` modo social.
2. Ingresa **código de academia**.
3. Front guarda código en `localStorage` (`pendingAcademyCode`) y además lo pasa en redirect query (`?academyCode=...`).
4. Tras callback de OAuth, usuario vuelve a `/`.
5. `src/app/page.tsx` detecta:
   - si faltan datos obligatorios (`phone`, `national_id`, `birth_date`) => abre modal obligatorio.
   - si no faltan datos y hay `academyCode` pendiente => llama silenciosamente a `/api/auth/complete-profile` para asegurar vinculación.
6. `/api/auth/complete-profile`:
   - actualiza metadata de auth
   - asegura `profiles` (`student`)
   - asegura `user_roles` (`student`)
   - asegura `user_academies` con la academia del código
   - asegura `students`
   - envía welcome email una vez (controlado por `profile_completed_at`)

---

## Decisiones técnicas importantes

- El “código de academia” actual se resuelve usando `academies.slug`.
- No se creó tabla nueva de invitaciones en esta iteración.
- El rol principal del auto-registro se fuerza a `student`.
- Cambio a otros roles se mantiene como gestión administrativa posterior.

---

## Riesgos / validaciones pendientes

1. **Apple Provider**
   - Debe estar configurado en Supabase Auth (client id, key, team id, etc.).
   - Si no está configurado, botón Apple devuelve error del proveedor.

2. **Unicidad de email**
   - La maneja Supabase Auth.
   - Mensajes de error dependen del texto retornado por Supabase.

3. **Código de academia (slug)**
   - Debe existir y mantenerse estable en `academies.slug`.
   - Si negocio requiere código no visible/rotativo, será necesario evolucionar a tabla de invitaciones.

4. **RLS y privilegios**
   - Se usa `supabaseAdmin` en rutas server para inserts de vínculo/rol.

---

## Cómo retomar rápido esta rama en próxima iteración

1. Ir a rama:
   - `git checkout feature/register`
   - `git pull`
2. Revisar estos archivos primero:
   - `src/app/(auth)/register/page.tsx`
   - `src/app/api/auth/register/route.ts`
   - `src/app/api/auth/complete-profile/route.ts`
   - `src/app/page.tsx`
3. Validar build:
   - `npm run build`
4. Probar casos clave manualmente:
   - registro manual exitoso con código válido
   - error por código inválido
   - OAuth Google con código + perfil incompleto
   - OAuth Apple con código (si provider habilitado)
   - academia suspendida (debe bloquear registro)

---

## Próximos pasos sugeridos (si se continúa esta feature)

1. Mostrar ayuda visual del formato de código de academia y validación inline en `/register`.
2. Estandarizar mensajes de error de auth para UX más clara.
3. Evaluar evolución a invitaciones con expiración/uso único (si producto lo requiere).
4. Agregar pruebas E2E del flujo completo de registro.
