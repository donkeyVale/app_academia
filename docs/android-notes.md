# Android (Capacitor) - Notas y pendientes

## Objetivo
Primera versión Android (Capacitor) estable con:
- Login normal OK.
- Sin preloader infinito en WebView.
- (Pendiente) “Ingreso rápido” por biometría/PIN con sesión persistida en Secure Storage.

## Contexto / estructura del proyecto
- Proyecto Capacitor vive en `mobile/`.
- Comandos Capacitor deben ejecutarse desde `mobile/` (no desde `mobile/android`).
- La app Android carga el sitio remoto (no assets embebidos):
  - `mobile/capacitor.config.ts` tiene `server.url: https://agendo.nativatech.com.py`.
  - El archivo empaquetado en Android confirma lo mismo: `mobile/android/app/src/main/assets/capacitor.config.json`.

## Estado actual (baseline estable)
- **Android volvió a funcionar (sin preloader infinito) al volver al commit:** `519461a`.
  - Nota: este commit fue alcanzado haciendo `git reset --hard <commit>` + `git push --force-with-lease origin main`.
  - La PWA en producción nunca dejó de funcionar; el problema era específico del WebView de Android.

## Qué se intentó / qué se implementó (en commits posteriores a `519461a`)
Estas implementaciones existen en el historial pero actualmente quedaron fuera del baseline estable al volver a `519461a`.

### 1) Biometría: login rápido (UI + helper + logout cleanup)
- Se integró login rápido con:
  - Plugin biometría: `@aparajita/capacitor-biometric-auth` (aparece como `BiometricAuthNative` en `window.Capacitor.Plugins`).
  - Plugin secure storage: `@aparajita/capacitor-secure-storage`.
- En dispositivos low-end (ej. Samsung A04):
  - `checkBiometry()` puede devolver `isAvailable: false` con `deviceIsSecure: true`.
  - Se agregó fallback a credencial del dispositivo (PIN/patrón) para permitir “Ingreso rápido” aunque no haya biometría soportada por BiometricPrompt.

### 2) SecureStorage: causa raíz de `invalidData`
- Error observado: `invalidData` / `The data in the store is in an invalid format`.
- Hallazgo clave: para escribir correctamente se debía usar el campo **`data`** (no `value`) al llamar `internalSetItem`.
- Se aplicó fix en helper (en commits posteriores) para persistir tokens/sesión usando el formato correcto.

### 3) Supabase en Android (WebView) vs Web (PWA)
Problema general: Android WebView no restauraba sesión bien con auth basada en cookies.

Se intentaron cambios para separar comportamiento por plataforma:
- En **web/PWA** mantener `@supabase/auth-helpers-nextjs` (cookies).
- En **native (Capacitor/WebView)** usar `@supabase/supabase-js` con `localStorage` para persistir sesión.
- Se implementó caching/singleton de clientes para evitar múltiples instancias de GoTrue (`Multiple GoTrueClient instances`).

Archivos tocados en esos commits:
- `src/lib/supabase.ts` (detección robusta de WebView por UA/Capacitor + client selection + singleton).

### 4) Middleware: evitar redirect loops en Android
- Se agregó bypass de enforcement de sesión en middleware para user agents nativos (Capacitor/WebView) para evitar loops.
- Archivo: `src/middleware.ts`.

### 5) Preloader infinito en Android: sospecha Service Worker / reload loop
- Se identificó un patrón de reload en `src/app/layout.tsx`:
  - `controllerchange` → `window.location.reload()`.
- Se intentó deshabilitar registro de service worker en WebView.
- Se intentó también agregar overlay de errores (`window.onerror` / `unhandledrejection`) para diagnosticar.
- Resultado: no fue suficiente; el WebView seguía pegado en preloader hasta volver a `519461a`.

### 6) Deploy bloqueado por errores de TypeScript (`never`)
- Vercel compila y luego corre TypeScript; empezaron a fallar páginas con errores tipo:
  - `Property 'role' does not exist on type 'never'`
  - `Property 'id' does not exist on type 'never'`
- Causa: falta de tipos `Database` para Supabase (queries de `.from('table')` sin typing terminan en `never` en varios lugares).
- Fixes temporales aplicados en commits posteriores:
  - Tipar explícitamente `.maybeSingle<{ ... }>()`.
  - En inserts/updates, cast del query builder a `any` para destrabar build.

## Incidentes y mitigaciones
### 1) Android: preloader infinito
- Síntoma: la app Capacitor se quedaba en preloader infinito.
- Señal clave: en Chrome dentro del emulador el sitio funcionaba, pero en la app no.
- Mitigación efectiva: volver a commit `519461a`.

### 2) DNS emulador (NXDOMAIN)
- Tras wipe del emulador, el dominio `agendo.nativatech.com.py` resolvía NXDOMAIN.
- Fix: configurar Private DNS (ej. `dns.google` o Cloudflare) y reiniciar conectividad.

## Cómo probar Android (checklist)
### A) Verificar que el sitio remoto está OK
- Abrir `https://agendo.nativatech.com.py` en Chrome (emulador).

### B) Probar la app Capacitor
- En el emulador:
  - Settings → Apps → Agendo → Storage & cache.
  - `Clear storage/data`.
  - `Force stop`.
  - Abrir la app.

## Cómo retomar biometría sin romper Android (estrategia recomendada)
El baseline estable es `519461a`. Para reintroducir biometría y fixes de Supabase sin romper WebView:

1) Crear una rama de trabajo desde `519461a`.
2) Reintroducir cambios por bloques (no todo junto), validando Android en cada paso.
3) Si se rompe, identificar el commit exacto (bisect manual) y hacer fix puntual.

Bloques sugeridos (orden):
- **Bloque 1:** SecureStorage (arreglar `data` vs `value`, limpieza por prefijo, persistencia de tokens).
- **Bloque 2:** Biometría (UI + helper) con fallback a PIN.
- **Bloque 3:** Supabase native client (supabase-js + localStorage + singleton).
- **Bloque 4:** Middleware bypass (solo si vuelve a aparecer loop de redirects).
- **Bloque 5:** Service Worker: mantener PWA estable, pero evitar loops en WebView si reaparece.

## Pendientes (alta prioridad) para “primera versión Android”
### 1) Biometría / Ingreso rápido (no funciona actualmente en baseline `519461a`)
- Objetivo: guardar sesión tras login normal y permitir re-login con biometría/PIN.
- Requiere:
  - SecureStorage estable.
  - Endpoint/API de re-login con refresh/access token bien almacenados.

### 2) SecureStorage (`invalidData`)
- Próximos pasos sugeridos:
  - Probar limpieza manual por consola:
    - `SecureStorage.clearItemsWithPrefix({ prefix: "agendo_" })`
    - validar con `SecureStorage.getPrefixedKeys({ prefix: "agendo_" })`.
  - Probar borrar 1 por 1:
    - obtener keys con `getPrefixedKeys` y luego `internalRemoveItem({ prefixedKey })`.
  - Si persiste: revisar implementación nativa Android del plugin para entender `invalidData` y cómo resetear completamente.
  - Alternativa: cambiar estrategia de persistencia (EncryptedSharedPreferences u otro plugin).

### 3) Tipos Supabase (para no romper deploy por `never`)
- Implementar tipos `Database` (generados desde Supabase) y tipar el cliente.
- Objetivo: eliminar casts a `any` y evitar cascada de errores en build.

### 4) Icono/logo monocromo (Android 13+)
- Pendiente agregar asset monocromo para `adaptive icon`.
- Revisar: `mobile/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml` (o equivalente) y agregar `<monochrome .../>`.

### 5) Checklist release (Play)
- Signing.
- `assetlinks.json`.
- Iconos (incl. monocromo).
- QA E2E en emulador y dispositivo real.

## Notas de debugging
- Warning visto: `Failed to load resource: net::ERR_UNKNOWN_URL_SCHEME`.
  - Generalmente benigno en WebView/Capacitor, no necesariamente relacionado a biometría.
