"use client";

import Link from "next/link";
import { CalendarDays, Users, CreditCard, UserCog, BarChart3 } from "lucide-react";
import React from "react";

interface FooterNavProps {
  isAdmin: boolean;
  rightSlot: React.ReactNode;
}

export function FooterNav({ isAdmin, rightSlot }: FooterNavProps) {
  return (
    <nav className="fixed bottom-0 inset-x-0 border-t bg-white/95 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex-1 flex items-center gap-3 text-xs sm:text-sm overflow-x-auto">
          <Link
            href="/schedule"
            className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md hover:bg-gray-50"
          >
            <CalendarDays className="w-4 h-4 text-[#3b82f6]" />
            <span>Agenda</span>
          </Link>
          <Link
            href="/students"
            className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md hover:bg-gray-50"
          >
            <Users className="w-4 h-4 text-[#22c55e]" />
            <span>Alumnos</span>
          </Link>
          <Link
            href="/finance"
            className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md hover:bg-gray-50"
          >
            <CreditCard className="w-4 h-4 text-[#3cadaf]" />
            <span>Finanzas</span>
          </Link>
          {isAdmin && (
            <Link
              href="/users"
              className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md hover:bg-gray-50"
            >
              <UserCog className="w-4 h-4 text-[#f97316]" />
              <span>Usuarios</span>
            </Link>
          )}
          <Link
            href="/reports"
            className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md hover:bg-gray-50"
          >
            <BarChart3 className="w-4 h-4 text-[#6366f1]" />
            <span>Reportes</span>
          </Link>
        </div>

        <div className="relative flex items-center">{rightSlot}</div>
      </div>
    </nav>
  );
}
