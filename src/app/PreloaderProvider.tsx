"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export default function PreloaderProvider({ children }: { children: React.ReactNode }) {
  const [showPreloader, setShowPreloader] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setShowPreloader(false);
    }, 1400);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <>
      {showPreloader && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-[#0f172a] via-[#1d3b4f] to-[#3cadaf] text-white">
          <div className="flex flex-col items-center gap-3">
            <div
              className="h-20 w-20 rounded-full bg-white/10 border border-white/40 flex items-center justify-center overflow-hidden animate-spin"
              style={{ animationDuration: '1.5s' }}
            >
              <Image
                src="/icons/LogoAgendo1024.png"
                alt="Icono de la app"
                width={96}
                height={96}
                className="object-cover"
              />
            </div>
            <div className="text-center">
              <div className="text-xs text-white/80 mt-1">Cargando tu agenda.....</div>
            </div>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
