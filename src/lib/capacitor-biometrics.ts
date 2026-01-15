import { isCapacitorNativePlatform } from '@/lib/capacitor-onesignal';

type BiometricSession = {
  access_token: string;
  refresh_token: string;
};

const BIOMETRIC_ENABLED_KEY = 'biometricLoginEnabled';
const BIOMETRIC_SESSION_KEY = 'biometricSupabaseSession';

function getPlugins(): any | null {
  if (typeof window === 'undefined') return null;
  const cap: any = (window as any).Capacitor;
  return cap?.Plugins ?? null;
}

function getBiometricAuthPlugin(plugins: any | null): any | null {
  if (!plugins) return null;
  const direct =
    plugins.BiometricAuth ??
    plugins.BiometricAuthentication ??
    plugins.Biometric ??
    plugins.Biometrics ??
    plugins.BiometricAuthPlugin;
  if (direct) return direct;

  try {
    const key = Object.keys(plugins).find((k) => k.toLowerCase().includes('biometric'));
    return key ? (plugins as any)[key] : null;
  } catch {
    return null;
  }
}

function getSecureStoragePlugin(plugins: any | null): any | null {
  if (!plugins) return null;
  const direct =
    plugins.SecureStorage ??
    plugins.SecureStoragePlugin ??
    plugins.SecureStorageNative ??
    plugins.SecureStorageAndroid ??
    plugins.SecureStorageIOS;
  if (direct) return direct;

  try {
    const key = Object.keys(plugins).find((k) => k.toLowerCase().includes('secure') && k.toLowerCase().includes('storage'));
    return key ? (plugins as any)[key] : null;
  } catch {
    return null;
  }
}

export function isBiometricEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(BIOMETRIC_ENABLED_KEY) === '1';
  } catch {
    return false;
  }
}

export function setBiometricEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled ? '1' : '0');
  } catch {
  }
}

export async function checkBiometryAvailable(): Promise<{ isAvailable: boolean; reason?: string }>{
  if (!isCapacitorNativePlatform()) return { isAvailable: false, reason: 'web' };
  const plugins = getPlugins();
  const BiometricAuth = getBiometricAuthPlugin(plugins);

  if (!BiometricAuth) return { isAvailable: false, reason: 'no_plugin' };
  const checkFn =
    BiometricAuth.checkBiometry ??
    BiometricAuth.checkBiometryAvailable ??
    BiometricAuth.checkBiometryAvailability ??
    BiometricAuth.isAvailable;
  if (typeof checkFn !== 'function') return { isAvailable: false, reason: 'no_plugin' };
  try {
    const info = await checkFn();
    if (typeof info === 'boolean') return { isAvailable: info, reason: '' };
    const biometryType = (info?.biometryType ?? info?.biometry ?? info?.type ?? '') as any;
    const typeStr = String(biometryType ?? '');
    const deviceIsSecure = !!info?.deviceIsSecure;
    const isAvailable = !!(
      info?.isAvailable ??
      info?.available ??
      info?.biometryAvailable ??
      info?.hasBiometry ??
      info?.isEnrolled ??
      (typeStr && typeStr.toLowerCase() !== 'none' && typeStr !== '0')
    );
    const reason = String(info?.reason ?? info?.status ?? info?.message ?? typeStr ?? '');

    if (isAvailable) return { isAvailable: true, reason };
    if (deviceIsSecure) {
      return { isAvailable: true, reason: 'device_credential' };
    }
    return { isAvailable: false, reason };
  } catch (e: any) {
    return { isAvailable: false, reason: e?.message ?? String(e) };
  }
}

export async function biometricAuthenticate(): Promise<boolean> {
  if (!isCapacitorNativePlatform()) return false;
  const plugins = getPlugins();
  const BiometricAuth = getBiometricAuthPlugin(plugins);
  if (!BiometricAuth?.authenticate) return false;
  try {
    await BiometricAuth.authenticate({
      reason: 'Confirmá tu identidad para ingresar.',
      cancelTitle: 'Cancelar',
      allowDeviceCredential: true,
      iosFallbackTitle: 'Usar código',
      androidTitle: 'Ingreso con biometría',
      androidSubtitle: 'Accedé con huella o rostro',
      androidConfirmationRequired: false,
      androidBiometryStrength: 0,
    });
    return true;
  } catch {
    return false;
  }
}

export async function storeBiometricSession(session: BiometricSession): Promise<void> {
  if (!isCapacitorNativePlatform()) return;
  const plugins = getPlugins();
  const SecureStorage = getSecureStoragePlugin(plugins);
  if (!SecureStorage?.set) throw new Error('No se encontró el plugin SecureStorage.');
  await SecureStorage.setKeyPrefix('agendo_');
  await SecureStorage.set(BIOMETRIC_SESSION_KEY, session);
}

export async function loadBiometricSession(): Promise<BiometricSession | null> {
  if (!isCapacitorNativePlatform()) return null;
  const plugins = getPlugins();
  const SecureStorage = getSecureStoragePlugin(plugins);
  if (!SecureStorage?.get) return null;
  try {
    await SecureStorage.setKeyPrefix('agendo_');
    const data = await SecureStorage.get(BIOMETRIC_SESSION_KEY);
    if (!data || typeof data !== 'object') return null;
    const s: any = data;
    if (!s.access_token || !s.refresh_token) return null;
    return { access_token: String(s.access_token), refresh_token: String(s.refresh_token) };
  } catch {
    return null;
  }
}

export async function clearBiometricSession(): Promise<void> {
  if (!isCapacitorNativePlatform()) return;
  const plugins = getPlugins();
  const SecureStorage = getSecureStoragePlugin(plugins);
  if (!SecureStorage?.remove) return;
  try {
    await SecureStorage.setKeyPrefix('agendo_');
    await SecureStorage.remove(BIOMETRIC_SESSION_KEY);
  } catch {
  }
}
