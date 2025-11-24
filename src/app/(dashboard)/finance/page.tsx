"use client";

import PlansClient from './PlansClient';
import { CreditCard } from 'lucide-react';

export default function FinancePage() {
  return (
    <section className="mt-4 space-y-6 max-w-5xl mx-auto px-4">
      <div className="flex items-start gap-2">
        <CreditCard className="h-5 w-5 text-[#3cadaf] flex-shrink-0" />
        <div className="space-y-0.5">
          <h1 className="text-2xl font-semibold text-[#31435d]">Finanzas</h1>
          <p className="text-sm text-gray-600">Gestión de planes, saldos y pagos.</p>
        </div>
      </div>
      <PlansClient />
    </section>
  );
}
