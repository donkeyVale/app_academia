"use client";

import Image from "next/image";
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
            <div className="h-16 w-16 rounded-full bg-white/10 border border-white/40 flex items-center justify-center overflow-hidden animate-pulse">
              <Image
                src="/icons/icon-512.png"
                alt="Icono de la app"
                width={64}
                height={64}
                className="object-cover"
              />
            </div>
            <div className="text-center">
              <div className="text-xs text-white/80 mt-1">Gestioná tu agenda en un solo lugar.</div>
            </div>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
