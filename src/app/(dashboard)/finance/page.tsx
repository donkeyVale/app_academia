"use client";

import Link from 'next/link';
import Image from 'next/image';
import PlansClient from './PlansClient';
import { CreditCard } from 'lucide-react';

export default function FinancePage() {
  return (
    <section className="mt-4 space-y-6 max-w-5xl mx-auto px-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2">
          <CreditCard className="h-5 w-5 text-[#3cadaf] flex-shrink-0" />
          <div className="space-y-0.5">
            <h1 className="text-2xl font-semibold text-[#31435d]">Finanzas</h1>
            <p className="text-sm text-gray-600">Gestión de planes, saldos y pagos.</p>
          </div>
        </div>
        <div className="flex items-center justify-end flex-1">
          <Link href="/" className="flex items-center">
            <div className="h-16 w-32 relative">
              <Image
                src="/icons/logoHome.png"
                alt="Agendo"
                fill
                className="object-contain"
                priority
              />
            </div>
          </Link>
        </div>
      </div>
      <PlansClient />
    </section>
  );
}
