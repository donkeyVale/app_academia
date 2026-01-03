# Handoff / Estado de la rama `feature/capacitor-v1`

Este documento resume el avance y deja un checklist para continuar el desarrollo desde macOS (Windsurf) sin perder contexto.

## Objetivo de la rama

- Mantener el web app (Next.js en Vercel) como “fuente de verdad” y envolverlo con Capacitor (Android/iOS).
- Tener un entorno de **staging** en Supabase y un dominio separado para pruebas.
- Dejar configurados deep links (esquema custom + links HTTPS) para Android/iOS.
- Preparar lo mínimo requerido por stores (Privacy Policy + Support).
- Preparar pipeline CI (GitHub Actions) para builds Android (APK debug + AAB release).

---

## URLs y refs importantes

- **PROD Supabase project ref**: `jfakyrcvajfqqnmvslab`
- **STAGING Supabase project ref**: `ixqssijhwwooizpbuzkm`

- **PROD Web URL**: `https://agendo.nativatech.com.py`
- **STAGING/Capacitor Web URL**: `https://capacitor.nativatech.com.py`

- **Capacitor App ID**: `com.nativatech.agendo`
- **Capacitor App Name**: `Agendo`

- **Custom URL scheme**: `agendo://`

---

## Supabase: schema versioning + baseline

### Estado

- Se generó un baseline de migración para la DB de producción.

### Archivo clave

- `supabase/migrations/20260101213745_baseline_prod.sql`

### Nota de workflow

- La idea es:
  - Tener baseline en repo
  - Aplicarlo a staging con `supabase db push`
  - Mantener futuras modificaciones como nuevas migraciones

---

## Vercel: staging/preview

### Estado

- Se configuró el dominio `https://capacitor.nativatech.com.py` para testing.
- Se desactivó **Deployment Protection** (esto era crítico para que el WebView en Android cargue el contenido sin bloquearse).

### Variables de entorno

- Existen variables separadas para preview/staging (Supabase URL/keys, SMTP, VAPID, etc.).

---

## Next.js: rutas públicas necesarias para stores

### Rutas

- **Privacy Policy**: `/privacy-policy`
  - Archivo: `src/app/privacy-policy/page.tsx`

- **Support**: `/support`
  - Archivo: `src/app/support/page.tsx`
  - Contacto: `mailto:soporte@nativatech.com.py`

### Importante (auth middleware)

- El middleware de auth fue ajustado para permitir acceso público a:
  - `/privacy-policy`
  - `/support`
  - `/.well-known/*`
  - `/apple-app-site-association`

Archivo:
- `src/middleware.ts`

---

## Android App Links: verificación HTTPS

### Estado

- Se agregó `assetlinks.json` para verificación de Android App Links.

Archivo:
- `public/.well-known/assetlinks.json`

### Notas

- Se excluyó `/.well-known` del middleware de auth para que Android pueda descargar el JSON sin redirect a login.

---

## iOS Universal Links: dominio-side

### Estado

- Se agregó `apple-app-site-association` en:
  - `public/apple-app-site-association`
  - `public/.well-known/apple-app-site-association`

- Se configuraron headers en Next.js para servirlos como JSON y sin caché.

Archivo:
- `next.config.ts`

### Pendiente

- Reemplazar `TEAMID` definitivo cuando Apple apruebe/esté disponible.

---

## Capacitor (mobile/)

### Estructura

- `mobile/` contiene el proyecto Capacitor.
- Config principal:
  - `mobile/capacitor.config.ts`

### Notas importantes

- Por issue de Node/npx en Windows, se usó preferentemente:
  - `npm exec -- cap ...`
  - o `npm --prefix .\mobile exec -- cap ...`

### Android deep links

- `mobile/android/app/src/main/AndroidManifest.xml`
  - intent-filters para:
    - `agendo://...`
    - `https://capacitor.nativatech.com.py/...` con `android:autoVerify="true"`

### iOS deep links (custom scheme)

- `mobile/ios/App/App/Info.plist`
  - `CFBundleURLTypes` para `agendo`

---

## Android release signing (local)

### Estado

- Se preparó Gradle para cargar firma release desde `mobile/android/keystore.properties` si existe.

Archivo:
- `mobile/android/app/build.gradle`

Ejemplo:
- `mobile/android/keystore.properties.example`

### Pendiente

- Generar keystore release (si todavía no se generó) y crear `keystore.properties` real en local.

---

## GitHub Actions (CI): build Android APK + AAB

Workflow:
- `.github/workflows/android-build.yml`

### Qué genera

- APK debug (`assembleDebug`)
- AAB release (`bundleRelease`)

### Firma release en CI (opcional)

- El workflow firma release **solo si** existen los secrets:
  - `ANDROID_KEYSTORE_BASE64`
  - `ANDROID_KEYSTORE_PASSWORD`
  - `ANDROID_KEY_ALIAS`
  - `ANDROID_KEY_PASSWORD`

---

# Migración urgente a macOS (Windsurf) – Checklist

Objetivo: poder continuar hoy el desarrollo desde Mac con toolchain iOS y mantener el mismo workflow de Supabase/Vercel.

## 1) Clonar repo y preparar Node

- Instalar Node 20 (recomendado con nvm)
- En repo:
  - `npm ci`
  - `npm --prefix ./mobile ci`

## 2) Docker + Supabase CLI

- Instalar Docker Desktop (Mac)
- Instalar Supabase CLI (elige una opción):
  - `brew install supabase/tap/supabase`
  - o `npm i -D supabase`

Validar:
- `docker version`
- `supabase --version`

Si vas a hacer operaciones DB:
- `supabase login`
- `supabase link --project-ref <ref>`

## 3) Vercel

- Instalar Vercel CLI (opcional): `npm i -g vercel`
- Confirmar variables env en Vercel (Production vs Preview) según `feature/capacitor-v1`.

## 4) iOS toolchain

- Instalar Xcode (App Store)
- Abrir Xcode una vez para que instale componentes
- Instalar CocoaPods:
  - `sudo gem install cocoapods`

## 5) Correr iOS (iPhone)

En la raíz del repo:
- `npm --prefix ./mobile exec -- cap sync ios`
- `npm --prefix ./mobile exec -- cap open ios`

En Xcode:
- Signing & Capabilities
  - marcar “Automatically manage signing”
  - elegir Team (Apple ID personal si todavía no hay Apple Developer Organization)
- Run en iPhone

## 6) Android (opcional en Mac)

- Instalar Android Studio
- `npm --prefix ./mobile exec -- cap sync android`
- `npm --prefix ./mobile exec -- cap open android`

---

# Comandos rápidos (día a día)

## Web (Next.js)

- `npm run dev`

## Capacitor sync

- `npm --prefix ./mobile exec -- cap sync android`
- `npm --prefix ./mobile exec -- cap sync ios`

---

# Verificación rápida (sanity checks)

- `https://capacitor.nativatech.com.py/privacy-policy` (no debe redirigir a login)
- `https://capacitor.nativatech.com.py/support` (no debe redirigir a login)
- `https://capacitor.nativatech.com.py/.well-known/assetlinks.json` (debe servir JSON)
- `https://capacitor.nativatech.com.py/.well-known/apple-app-site-association` (debe servir JSON)

---

# Próximos pasos sugeridos

- Correr iOS en iPhone desde Mac hoy (cuenta gratuita si es necesario).
- Completar release signing (keystore) y cargar secrets para AAB firmado.
- Definir distribución:
  - Android: Play Internal Testing (requiere AAB firmado)
  - iOS: TestFlight (requiere Apple Developer Program)
