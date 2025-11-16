"use client";

import PlansClient from './PlansClient';

export default function FinancePage() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Finanzas</h1>
      <ul className="list-disc pl-6">
        <li>Registro manual de pagos (pendiente)</li>
        <li>Planes/bonos y saldo</li>
        <li>Reportes simples (CSV) (pendiente)</li>
      </ul>
      <PlansClient />
    </section>
  );
}
