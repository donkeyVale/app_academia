"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, X } from "lucide-react";
import { createClientBrowser } from "@/lib/supabase";

const HIDE_PUSH_PERMISSION_BANNER_KEY = "hide_push_permission_banner";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushPermissionPrompt() {
  const supabase = createClientBrowser();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(HIDE_PUSH_PERMISSION_BANNER_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [loading, setLoading] = useState(true);
  const [enabledInApp, setEnabledInApp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isStandalone = useMemo(() => {
    if (typeof window === "undefined") return false;
    return (
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      (window.navigator as any).standalone === true
    );
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await supabase.auth.getUser();
        const user = data.user;
        if (!user) {
          if (!active) return;
          setEnabledInApp(false);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("notifications_enabled")
          .eq("id", user.id)
          .maybeSingle();

        if (!active) return;
        setEnabledInApp(typeof profile?.notifications_enabled === "boolean" ? (profile.notifications_enabled as boolean) : true);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message ?? null);
        setEnabledInApp(false);
      } finally {
        if (!active) return;
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [supabase]);

  const canPrompt = useMemo(() => {
    if (dismissed) return false;
    if (loading) return false;
    if (!enabledInApp) return false;
    if (typeof window === "undefined") return false;
    if (typeof Notification === "undefined" || typeof Notification.requestPermission !== "function") return false;
    if (Notification.permission !== "default") return false;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) return false;
    return true;
  }, [dismissed, enabledInApp, loading]);

  const onEnable = async () => {
    setBusy(true);
    setError(null);
    try {
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        setError("Falta configurar VAPID.");
        return;
      }

      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id as string | undefined;
      if (!userId) return;

      const permission = await Notification.requestPermission();
      if (permission !== "default") {
        try {
          window.localStorage.setItem("pushPermissionPrompted", "1");
        } catch {
          // ignore
        }
      }

      if (permission !== "granted") return;

      let registration: ServiceWorkerRegistration;
      try {
        registration = await navigator.serviceWorker.ready;
      } catch {
        registration = await navigator.serviceWorker.register("/sw.js");
      }

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey as unknown as ArrayBuffer,
        });
      }

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...subscription.toJSON(), userId, platform: "web" }),
      });

      setDismissed(true);
      try {
        window.localStorage.setItem(HIDE_PUSH_PERMISSION_BANNER_KEY, "true");
      } catch {
        // ignore
      }
    } catch (err: any) {
      setError(err?.message ?? "No se pudieron activar las notificaciones.");
    } finally {
      setBusy(false);
    }
  };

  if (!canPrompt) return null;

  return (
    <div className="fixed bottom-[128px] left-0 right-0 z-50 px-4">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-3 rounded-xl border bg-white shadow-lg px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-[#e6f5f6] flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-[#3cadaf]" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[#31435d] truncate">Activar notificaciones</div>
              <div className="text-xs text-gray-600 truncate">
                {isStandalone ? "Recibí recordatorios de clases en tu dispositivo." : "Instalá la app para mejores resultados en iPhone."}
              </div>
              {error && <div className="text-[11px] text-red-600 mt-1">{error}</div>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={busy}
              className="text-xs px-3 py-2 rounded-lg bg-[#3cadaf] text-white hover:bg-[#31435d] disabled:opacity-60"
              onClick={onEnable}
            >
              {busy ? "Activando..." : "Activar"}
            </button>
            <button
              type="button"
              className="p-2 rounded-lg hover:bg-gray-50"
              aria-label="Cerrar"
              onClick={() => {
                setDismissed(true);
                try {
                  window.localStorage.setItem(HIDE_PUSH_PERMISSION_BANNER_KEY, "true");
                } catch {
                  // ignore
                }
              }}
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
