'use client';

import { useEffect } from 'react';

function extractPathFromDeepLink(rawUrl: string): string | null {
  try {
    if (!rawUrl || typeof rawUrl !== 'string') return null;

    if (rawUrl.startsWith('agendo://')) {
      const rest = rawUrl.slice('agendo://'.length);
      const withSlash = rest.startsWith('/') ? rest : `/${rest}`;
      return withSlash === '/' ? '/' : withSlash;
    }

    const u = new URL(rawUrl);
    if (u.host !== 'agendo.nativatech.com.py') return null;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}

export default function CapacitorDeeplinkHandler() {
  useEffect(() => {
    const w = window as any;
    const cap = w?.Capacitor;
    const app = cap?.Plugins?.App;

    if (!cap || !app) return;

    const navigateTo = (rawUrl: string) => {
      const path = extractPathFromDeepLink(rawUrl);
      if (!path) return;

      try {
        w.localStorage.setItem('pendingDeepLink', path);
      } catch {
      }

      if (w.location.pathname + w.location.search + w.location.hash === path) return;
      w.location.href = path;
    };

    let removeListener: (() => void) | null = null;

    (async () => {
      try {
        const launch = await app.getLaunchUrl();
        const launchUrl = launch?.url;
        if (launchUrl) navigateTo(launchUrl);
      } catch {
      }

      try {
        const handle = await app.addListener('appUrlOpen', (event: any) => {
          const url = event?.url;
          if (url) navigateTo(url);
        });
        removeListener = () => {
          try {
            handle?.remove?.();
          } catch {
          }
        };
      } catch {
      }
    })();

    return () => {
      try {
        removeListener?.();
      } catch {
      }
    };
  }, []);

  return null;
}
