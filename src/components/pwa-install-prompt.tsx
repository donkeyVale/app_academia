"use client";

import { useEffect, useMemo, useState } from 'react';
import { Smartphone, X } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const HIDE_IOS_INSTALL_BANNER_KEY = 'hide_ios_install_banner';

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(HIDE_IOS_INSTALL_BANNER_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [iosHelpOpen, setIosHelpOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateInstalled = () => {
      const standalone =
        (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
        (window.navigator as any).standalone === true;
      setInstalled(!!standalone);
    };

    updateInstalled();

    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setInstalled(true);
    };

    window.addEventListener('appinstalled', onAppInstalled);

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', onBip);

    const mq = window.matchMedia ? window.matchMedia('(display-mode: standalone)') : null;
    const onMqChange = () => updateInstalled();
    mq?.addEventListener?.('change', onMqChange);

    return () => {
      window.removeEventListener('appinstalled', onAppInstalled);
      window.removeEventListener('beforeinstallprompt', onBip);
      mq?.removeEventListener?.('change', onMqChange);
    };
  }, []);

  const isIosSafari = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const ua = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/i.test(ua);
    const isWebKit = /WebKit/i.test(ua);
    const isCriOS = /CriOS/i.test(ua);
    const isFxiOS = /FxiOS/i.test(ua);
    return isIOS && isWebKit && !isCriOS && !isFxiOS;
  }, []);

  // UX: este banner se usa solo para iOS Safari (en Android ya existe el prompt/botón nativo).
  const showInstall = !installed && !dismissed && isIosSafari;

  if (!showInstall) return null;

  return (
    <>
      <div className="fixed bottom-[76px] left-0 right-0 z-50 px-4">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-between gap-3 rounded-xl border bg-white shadow-lg px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-9 w-9 rounded-lg bg-[#e6f5f6] flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5 text-[#3cadaf]" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[#31435d] truncate">Instalar Agendo</div>
                <div className="text-xs text-gray-600 truncate">Acceso rápido como app (sin Play Store)</div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                className="text-xs px-3 py-2 rounded-lg bg-[#3cadaf] text-white hover:bg-[#31435d]"
                onClick={async () => {
                  if (deferredPrompt) {
                    try {
                      await deferredPrompt.prompt();
                      await deferredPrompt.userChoice.catch(() => null);
                    } finally {
                      setDeferredPrompt(null);
                    }
                    return;
                  }
                  if (isIosSafari) {
                    setIosHelpOpen(true);
                  }
                }}
              >
                Instalar
              </button>
              <button
                type="button"
                className="p-2 rounded-lg hover:bg-gray-50"
                aria-label="Cerrar"
                onClick={() => {
                  setDismissed(true);
                  if (typeof window !== 'undefined') {
                    try {
                      window.localStorage.setItem(HIDE_IOS_INSTALL_BANNER_KEY, 'true');
                    } catch {
                      // ignore
                    }
                  }
                }}
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {iosHelpOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl border">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="text-sm font-semibold text-[#31435d]">Instalar en iPhone/iPad</div>
              <button
                type="button"
                className="p-2 rounded-lg hover:bg-gray-50"
                aria-label="Cerrar"
                onClick={() => setIosHelpOpen(false)}
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="px-4 py-4 space-y-2 text-sm text-gray-700">
              <div>1) Tocá el botón de <span className="font-semibold">tres puntitos</span> (Más opciones).</div>
              <div>2) Elegí <span className="font-semibold">Compartir</span>.</div>
              <div>3) En el menú de Compartir, tocá otra vez los <span className="font-semibold">tres puntitos</span>.</div>
              <div>4) Elegí <span className="font-semibold">Agregar a inicio</span> o <span className="font-semibold">Agregar a pantalla de inicio</span>.</div>
              <div>5) Confirmá con <span className="font-semibold">Agregar</span>.</div>
            </div>
            <div className="px-4 pb-4">
              <button
                type="button"
                className="w-full text-sm px-4 py-2 rounded-lg bg-[#3cadaf] text-white hover:bg-[#31435d]"
                onClick={() => setIosHelpOpen(false)}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
