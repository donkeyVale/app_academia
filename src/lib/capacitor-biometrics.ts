import { isCapacitorNativePlatform } from '@/lib/capacitor-onesignal';

type BiometricSession = {
  access_token: string;
  refresh_token: string;
};

const BIOMETRIC_ENABLED_KEY = 'biometricLoginEnabled';
const BIOMETRIC_SESSION_KEY = 'biometricSupabaseSession';
const SECURE_STORAGE_PREFIX = 'agendo_';

function isInvalidSecureStorageFormat(e: any): boolean {
  const code = String(e?.code ?? '').toLowerCase();
  const msg = String(e?.message ?? '').toLowerCase();
  return code.includes('invalid') || msg.includes('invalid format');
}

function isMissingKey(e: any): boolean {
  const code = String(e?.code ?? '').toLowerCase();
  const msg = String(e?.message ?? '').toLowerCase();
  return code.includes('missingkey') || msg.includes('missing key') || msg.includes('empty key');
}

async function clearSecureStoragePrefix(plugin: any): Promise<void> {
  if (typeof plugin?.clearItemsWithPrefix !== 'function') return;
  const attempts = [
    { prefix: SECURE_STORAGE_PREFIX },
    { keyPrefix: SECURE_STORAGE_PREFIX },
    { prefixedKey: SECURE_STORAGE_PREFIX },
  ];
  for (const a of attempts) {
    try {
      await plugin.clearItemsWithPrefix(a);
      return;
    } catch {
    }
  }
}

async function handleInvalidFormat(plugin: any, key: string, tryWrite: () => Promise<void>): Promise<void> {
  try {
    await tryWrite();
  } catch (e: any) {
    if (isMissingKey(e)) {
      throw e;
    }
    if (isInvalidSecureStorageFormat(e) && typeof plugin.clearItemsWithPrefix === 'function') {
      await clearSecureStoragePrefix(plugin);
      await tryWrite();
    } else {
      throw e;
    }
  }
}

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

async function secureStorageSet(plugin: any, key: string, value: any): Promise<void> {
  if (!plugin) throw new Error('No se encontró el plugin SecureStorage.');
  const k = `${SECURE_STORAGE_PREFIX}${key}`;
  const v = typeof value === 'string' ? value : JSON.stringify(value);

  if (typeof plugin.set === 'function') {
    await plugin.setKeyPrefix?.(SECURE_STORAGE_PREFIX);
    await plugin.set(key, value);
    return;
  }
  if (typeof plugin.setItem === 'function') {
    await plugin.setItem({ key: k, value: v, data: v, prefixedKey: k, fullKey: k, options: { key: k, value: v }, item: { key: k, value: v } });
    return;
  }
  if (typeof plugin.internalSetItem === 'function') {
    const tryWrite = async () => {
      await plugin.internalSetItem({ prefixedKey: k, value: v });
    };
    await handleInvalidFormat(plugin, k, tryWrite);
    return;
  }
  throw new Error('No se encontró el plugin SecureStorage.');
}

async function secureStorageGet(plugin: any, key: string): Promise<any | null> {
  if (!plugin) return null;
  const k = `${SECURE_STORAGE_PREFIX}${key}`;

  const isMissingKey = (e: any) => {
    const code = String(e?.code ?? '').toLowerCase();
    const msg = String(e?.message ?? '').toLowerCase();
    return code.includes('missingkey') || msg.includes('missing key') || msg.includes('empty key');
  };

  if (typeof plugin.get === 'function') {
    await plugin.setKeyPrefix?.(SECURE_STORAGE_PREFIX);
    return await plugin.get(key);
  }
  if (typeof plugin.getItem === 'function') {
    const res = await plugin.getItem({ key: k, prefixedKey: k, fullKey: k, options: { key: k }, item: { key: k } });
    return res?.value ?? res;
  }
  if (typeof plugin.internalGetItem === 'function') {
    try {
      const res = await plugin.internalGetItem({ prefixedKey: k });
      return res?.value ?? res?.data ?? res;
    } catch (e: any) {
      if (isMissingKey(e)) return null;
      if (isInvalidSecureStorageFormat(e)) {
        await clearSecureStoragePrefix(plugin);
        return null;
      }
      throw e;
    }
  }
  return null;
}

async function secureStorageRemove(plugin: any, key: string): Promise<void> {
  if (!plugin) return;
  const k = `${SECURE_STORAGE_PREFIX}${key}`;

  const isMissingKey = (e: any) => {
    const code = String(e?.code ?? '').toLowerCase();
    const msg = String(e?.message ?? '').toLowerCase();
    return code.includes('missingkey') || msg.includes('missing key') || msg.includes('empty key');
  };

  if (typeof plugin.remove === 'function') {
    await plugin.setKeyPrefix?.(SECURE_STORAGE_PREFIX);
    await plugin.remove(key);
    return;
  }
  if (typeof plugin.removeItem === 'function') {
    await plugin.removeItem({ key: k, prefixedKey: k, fullKey: k, options: { key: k }, item: { key: k } });
    return;
  }
  if (typeof plugin.internalRemoveItem === 'function') {
    await plugin.internalRemoveItem({ prefixedKey: k });
    return;
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
  await secureStorageSet(SecureStorage, BIOMETRIC_SESSION_KEY, session);
}

export async function loadBiometricSession(): Promise<BiometricSession | null> {
  if (!isCapacitorNativePlatform()) return null;
  const plugins = getPlugins();
  const SecureStorage = getSecureStoragePlugin(plugins);
  try {
    const data = await secureStorageGet(SecureStorage, BIOMETRIC_SESSION_KEY);
    if (!data) return null;
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    if (!parsed || typeof parsed !== 'object') return null;
    const s: any = parsed;
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
  try {
    if (typeof SecureStorage?.clearItemsWithPrefix === 'function') {
      await SecureStorage.clearItemsWithPrefix({ prefix: SECURE_STORAGE_PREFIX });
      return;
    }
    await secureStorageRemove(SecureStorage, BIOMETRIC_SESSION_KEY);
  } catch {
  }
}
