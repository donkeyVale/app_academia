# Android (Capacitor) - Notas y pendientes

## Contexto
- Proyecto Capacitor vive en `mobile/`.
- Comandos Capacitor deben ejecutarse desde `mobile/` (no desde `mobile/android`).

## Biometría / Login rápido (estado actual)
- Se integró login rápido usando:
  - Plugin biometría: aparece como `BiometricAuthNative` en `window.Capacitor.Plugins`.
  - Plugin secure storage: aparece como `SecureStorage` con API `internalSetItem/internalGetItem/internalRemoveItem`, `clearItemsWithPrefix`, `getPrefixedKeys`.
- En dispositivos como Samsung A04:
  - `checkBiometry()` devuelve `isAvailable: false` con `deviceIsSecure: true`.
  - Se habilitó fallback a credencial del dispositivo (PIN/patrón) para permitir “Ingreso rápido” aunque no haya biometría soportada por BiometricPrompt.

## Pendientes (alta prioridad)
- **SecureStorage devuelve `invalidData` / "The data in the store is in an invalid format"**
  - Se observa incluso luego de intentar limpieza automática por prefijo (`agendo_`).
  - Impacto: no se puede guardar la sesión para login rápido.
  - Hipótesis:
    - Store quedó corrupto por intentos anteriores con payload incorrecto.
    - `clearItemsWithPrefix` no está limpiando lo que creemos, o el plugin mantiene un estado interno que requiere reinicio/clear a nivel nativo.
    - Puede requerir usar otro método del plugin (o una secuencia específica) para reset.
  - Próximos pasos sugeridos:
    - Probar limpieza manual por consola:
      - `SecureStorage.clearItemsWithPrefix({ prefix: "agendo_" })`
      - y validar con `SecureStorage.getPrefixedKeys({ prefix: "agendo_" })`.
    - Probar borrar 1 por 1:
      - obtener keys con `getPrefixedKeys` y luego `internalRemoveItem({ prefixedKey })`.
    - Si persiste: revisar documentación/implementación nativa del plugin (Android) para entender qué significa `invalidData` y cómo resetear completamente el store.
    - Alternativa: cambiar estrategia de persistencia (p.ej. usar otro plugin/Keychain/EncryptedSharedPreferences) o almacenar un blob distinto.

- **Icono/logo monocromo (Android 13+)**
  - Pendiente agregar el asset monocromo para `adaptive icon` (se usa para launcher/tematización y en algunos contextos de notificaciones en Android 13+).
  - Próximos pasos sugeridos:
    - Definir un SVG simple (1 color) del logo.
    - Generar `ic_launcher_monochrome` (y/o el recurso requerido por la config actual).
    - Revisar configuración en `mobile/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml` (o equivalente) para incluir `<monochrome .../>`.

## Pendientes (media prioridad)
- **E2E en emulador / dispositivo high-end**
  - Hacer pruebas con emulador configurado con biometría (o un dispositivo con huella/face fuerte soportado por BiometricPrompt).
  - Validar:
    - activar “Ingreso rápido”
    - logout
    - login con biometría
    - fallback a PIN/patrón (en low-end)

## Notas de debugging
- Warning visto: `Failed to load resource: net::ERR_UNKNOWN_URL_SCHEME` en consola.
  - Generalmente benigno en WebView/Capacitor, no necesariamente relacionado a biometría.
