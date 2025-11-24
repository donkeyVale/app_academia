"use client";

import PlansClient from './PlansClient';
import { CreditCard } from 'lucide-react';

export default function FinancePage() {
  return (
    <section className="mt-4 space-y-4 max-w-5xl mx-auto px-4">
      <div className="flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-[#3cadaf]" />
        <h1 className="text-2xl font-semibold text-[#31435d]">Finanzas</h1>
      </div>
      <ul className="list-disc pl-6 text-sm text-gray-700">
        <li>Registro manual de pagos (pendiente)</li>
        <li>Planes/bonos y saldo</li>
        <li>Reportes simples (CSV) (pendiente)</li>
      </ul>
      <PlansClient />
    </section>
  );
}
