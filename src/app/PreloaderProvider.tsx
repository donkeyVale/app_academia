"use client";

import { useEffect, useState } from "react";

export default function PreloaderProvider({ children }: { children: React.ReactNode }) {
  const [showPreloader, setShowPreloader] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setShowPreloader(false);
    }, 700);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <>
      {showPreloader && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-[#0f172a] via-[#1d3b4f] to-[#3cadaf] text-white">
          <div className="flex flex-col items-center gap-3">
            <div className="h-16 w-16 rounded-full bg-white/10 border border-white/40 flex items-center justify-center text-2xl font-bold tracking-tight animate-pulse">
              A
            </div>
            <div className="text-center">
              <div className="text-xl font-semibold tracking-tight">AGENDO</div>
              <div className="text-xs text-white/70 mt-1">Cargando tu agenda...</div>
            </div>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
