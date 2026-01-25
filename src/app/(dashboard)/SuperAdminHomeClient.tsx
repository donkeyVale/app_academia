"use client";

import Link from "next/link";
import { Shield, Building2, FileText, CreditCard, Settings2 } from "lucide-react";
import SuperAdminIncomeExpensesCard from "./SuperAdminIncomeExpensesCard";
import SuperAdminAcademyRankingCard from "./SuperAdminAcademyRankingCard";
import SuperAdminImpersonateAcademyCard from "./SuperAdminImpersonateAcademyCard";
import SuperAdminUsersByAcademyCard from "./SuperAdminUsersByAcademyCard";

export default function SuperAdminHomeClient({ userEmail }: { userEmail: string }) {
  return (
    <section
      className="mt-4 space-y-4 max-w-6xl mx-auto px-4"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 160px)' }}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-white px-3 py-1 text-[11px] font-semibold tracking-wide">
            <Shield className="h-4 w-4" />
            <span>Super Admin</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#0f172a] tracking-tight">Dashboard global</h1>
          <p className="text-sm text-gray-600">Usuario: {userEmail}</p>
          <p className="text-xs text-gray-500">
            Tip: seleccioná una academia desde el selector global (arriba) para ver métricas y comisiones.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
          <Link
            href="/super-admin/billing"
            className="inline-flex items-center justify-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-medium text-[#0f172a] shadow-sm hover:bg-gray-50"
          >
            <CreditCard className="h-4 w-4 text-[#3cadaf]" />
            <span>Facturación</span>
          </Link>
          <Link
            href="/super-admin/academias"
            className="inline-flex items-center justify-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-medium text-[#0f172a] shadow-sm hover:bg-gray-50"
          >
            <Building2 className="h-4 w-4 text-[#3cadaf]" />
            <span>Academias</span>
          </Link>
          <Link
            href="/reports"
            className="inline-flex items-center justify-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-medium text-[#0f172a] shadow-sm hover:bg-gray-50"
          >
            <FileText className="h-4 w-4 text-[#3cadaf]" />
            <span>Reportes</span>
          </Link>
          <Link
            href="/settings"
            className="inline-flex items-center justify-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-medium text-[#0f172a] shadow-sm hover:bg-gray-50"
          >
            <Settings2 className="h-4 w-4 text-[#3cadaf]" />
            <span>Config</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SuperAdminIncomeExpensesCard />
            <SuperAdminAcademyRankingCard />
          </div>
        </div>

        <div className="rounded-2xl border bg-white shadow-sm p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[#31435d]">Atajos</p>
            <span className="text-[11px] text-gray-500">Optimizado mobile</span>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2">
            <Link
              href="/super-admin/asignaciones"
              className="rounded-xl border bg-gray-50 px-3 py-2 text-xs font-medium text-[#0f172a] hover:bg-gray-100"
            >
              Asignaciones (academia/ubicaciones)
            </Link>
            <Link
              href="/super-admin/locations"
              className="rounded-xl border bg-gray-50 px-3 py-2 text-xs font-medium text-[#0f172a] hover:bg-gray-100"
            >
              Complejos
            </Link>
            <Link
              href="/users"
              className="rounded-xl border bg-gray-50 px-3 py-2 text-xs font-medium text-[#0f172a] hover:bg-gray-100"
            >
              Usuarios
            </Link>
          </div>

          <p className="mt-3 text-[11px] text-gray-500">
            Próximo: agregamos más KPIs globales y secciones colapsables para reducir scroll.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SuperAdminUsersByAcademyCard />
        </div>
        <div>
          <SuperAdminImpersonateAcademyCard />
        </div>
      </div>
    </section>
  );
}
