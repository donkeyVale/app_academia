export function isCapacitorNativePlatform(): boolean {
  if (typeof window === 'undefined') return false;
  const cap: any = (window as any).Capacitor;
  if (!cap) return false;
  try {
    if (typeof cap.isNativePlatform === 'function') return !!cap.isNativePlatform();
  } catch {
  }
  try {
    if (typeof cap.getPlatform === 'function') return cap.getPlatform() !== 'web';
  } catch {
  }
  return false;
}

function getOneSignalBridge(): any | null {
  if (typeof window === 'undefined') return null;
  const cap: any = (window as any).Capacitor;
  const plugins = cap?.Plugins;
  return plugins?.OneSignalBridge ?? null;
}

export async function oneSignalLoginExternalUserId(userId: string): Promise<boolean> {
  if (!userId) return false;
  if (!isCapacitorNativePlatform()) return false;
  const bridge = getOneSignalBridge();
  if (!bridge?.login) return false;
  try {
    await bridge.login({ userId });
    return true;
  } catch {
    return false;
  }
}

export async function oneSignalLogout(): Promise<boolean> {
  if (!isCapacitorNativePlatform()) return false;
  const bridge = getOneSignalBridge();
  if (!bridge?.logout) return false;
  try {
    await bridge.logout();
    return true;
  } catch {
    return false;
  }
}
