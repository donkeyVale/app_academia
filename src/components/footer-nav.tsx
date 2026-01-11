"use client";

import Link from "next/link";
import { CalendarDays, Users, CreditCard, UserCog, BarChart3, Settings, MoreHorizontal } from "lucide-react";
import React, { useState } from "react";

interface FooterNavProps {
  isAdmin: boolean;
  isStudent?: boolean;
  canSeeReports?: boolean;
  canSeeFinance?: boolean;
  canSeeSettings?: boolean;
  studentsLabel?: string;
  scheduleBadgeCount?: number;
  rightSlot: React.ReactNode;
}

export function FooterNav({ isAdmin, isStudent, canSeeReports, canSeeFinance, canSeeSettings, studentsLabel, scheduleBadgeCount, rightSlot }: FooterNavProps) {
  const showReports = canSeeReports !== false;
  const showFinance = canSeeFinance !== false;
  const showSettings = canSeeSettings === true;
  const studentsText = studentsLabel || 'Alumnos';
  // Caso típico de alumno: solo 3 ítems (Agenda, Mi cuenta, Configuración)
  const isStudentCompactNav = !isAdmin && !showReports && !showFinance && showSettings;
  const [moreOpen, setMoreOpen] = useState(false);
  const useMobileAdminCompactMenu = isAdmin;

  const scheduleBadgeLabel = (() => {
    const n = Number(scheduleBadgeCount ?? 0);
    if (!Number.isFinite(n) || n <= 0) return '';
    if (n > 99) return '99+';
    return String(n);
  })();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 border-t bg-white/95 backdrop-blur-sm"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)' }}
    >
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        {useMobileAdminCompactMenu ? (
          <>
            <div className="flex-1 sm:hidden flex items-center justify-between text-xs">
              <Link
                href="/schedule"
                className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md hover:bg-gray-50 overflow-visible"
              >
                <span className="relative inline-flex overflow-visible">
                  <CalendarDays className="w-5 h-5 text-[#3b82f6]" />
                  {scheduleBadgeLabel && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] leading-4 font-semibold text-center">
                      {scheduleBadgeLabel}
                    </span>
                  )}
                </span>
                <span>Agenda</span>
              </Link>
              <Link
                href={isStudent ? "/finance" : "/students"}
                className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md hover:bg-gray-50"
              >
                <Users className="w-5 h-5 text-[#22c55e]" />
                <span>{studentsText}</span>
              </Link>
              {showFinance ? (
                <Link
                  href="/finance"
                  className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md hover:bg-gray-50"
                >
                  <CreditCard className="w-5 h-5 text-[#3cadaf]" />
                  <span>Finanzas</span>
                </Link>
              ) : (
                <div className="w-[56px]" />
              )}
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md hover:bg-gray-50"
              >
                <MoreHorizontal className="w-5 h-5 text-[#64748b]" />
                <span>Más</span>
              </button>
            </div>

            <div
              className={
                isStudentCompactNav
                  ? 'hidden sm:flex items-center justify-center gap-6 text-xs sm:text-sm'
                  : 'hidden sm:flex flex-1 items-center gap-3 text-xs sm:text-sm overflow-x-auto'
              }
            >
              <Link
                href="/schedule"
                className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md hover:bg-gray-50 overflow-visible"
              >
                <span className="relative inline-flex overflow-visible">
                  <CalendarDays className="w-5 h-5 text-[#3b82f6]" />
                  {scheduleBadgeLabel && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] leading-4 font-semibold text-center">
                      {scheduleBadgeLabel}
                    </span>
                  )}
                </span>
                <span>Agenda</span>
              </Link>
              <Link
                href={isStudent ? "/finance" : "/students"}
                className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md hover:bg-gray-50"
              >
                <Users className="w-5 h-5 text-[#22c55e]" />
                <span>{studentsText}</span>
              </Link>
              {showFinance && (
                <Link
                  href="/finance"
                  className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md hover:bg-gray-50"
                >
                  <CreditCard className="w-5 h-5 text-[#3cadaf]" />
                  <span>Finanzas</span>
                </Link>
              )}
              {showSettings && (
                <Link
                  href="/settings"
                  className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md hover:bg-gray-50"
                >
                  <Settings className="w-5 h-5 text-[#64748b]" />
                  <span>Configuración</span>
                </Link>
              )}
              {isAdmin && (
                <Link
                  href="/users"
                  className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md hover:bg-gray-50"
                >
                  <UserCog className="w-5 h-5 text-[#f97316]" />
                  <span>Usuarios</span>
                </Link>
              )}
              {showReports && (
                <Link
                  href="/reports"
                  className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md hover:bg-gray-50"
                >
                  <BarChart3 className="w-5 h-5 text-[#6366f1]" />
                  <span>Reportes</span>
                </Link>
              )}
            </div>
          </>
        ) : (
          <div
            className={
              isStudentCompactNav
                ? 'flex items-center justify-center gap-6 text-xs sm:text-sm'
                : 'flex-1 flex items-center gap-3 text-xs sm:text-sm overflow-x-auto'
            }
          >
            <Link
              href="/schedule"
              className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md hover:bg-gray-50 overflow-visible"
            >
              <span className="relative inline-flex overflow-visible">
                <CalendarDays className="w-5 h-5 text-[#3b82f6]" />
                {scheduleBadgeLabel && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] leading-4 font-semibold text-center">
                    {scheduleBadgeLabel}
                  </span>
                )}
              </span>
              <span>Agenda</span>
            </Link>
            <Link
              href={isStudent ? "/finance" : "/students"}
              className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md hover:bg-gray-50"
            >
              <Users className="w-5 h-5 text-[#22c55e]" />
              <span>{studentsText}</span>
            </Link>
            {showFinance && (
              <Link
                href="/finance"
                className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md hover:bg-gray-50"
              >
                <CreditCard className="w-5 h-5 text-[#3cadaf]" />
                <span>Finanzas</span>
              </Link>
            )}
            {showSettings && (
              <Link
                href="/settings"
                className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md hover:bg-gray-50"
              >
                <Settings className="w-5 h-5 text-[#64748b]" />
                <span>Configuración</span>
              </Link>
            )}
            {isAdmin && (
              <Link
                href="/users"
                className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md hover:bg-gray-50"
              >
                <UserCog className="w-5 h-5 text-[#f97316]" />
                <span>Usuarios</span>
              </Link>
            )}
            {showReports && (
              <Link
                href="/reports"
                className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md hover:bg-gray-50"
              >
                <BarChart3 className="w-5 h-5 text-[#6366f1]" />
                <span>Reportes</span>
              </Link>
            )}
          </div>
        )}

        <div className="relative flex items-center">{rightSlot}</div>
      </div>

      {useMobileAdminCompactMenu && moreOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-xl bg-white border-t shadow-xl p-3">
            <div className="flex items-center justify-between pb-2">
              <p className="text-sm font-semibold text-slate-800">Menú</p>
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-700 underline-offset-2 hover:underline"
                onClick={() => setMoreOpen(false)}
              >
                Cerrar
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {showSettings && (
                <Link
                  href="/settings"
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Settings className="w-5 h-5 text-[#64748b]" />
                  <span>Configuración</span>
                </Link>
              )}
              {isAdmin && (
                <Link
                  href="/users"
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <UserCog className="w-5 h-5 text-[#f97316]" />
                  <span>Usuarios</span>
                </Link>
              )}
              {showReports && (
                <Link
                  href="/reports"
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <BarChart3 className="w-5 h-5 text-[#6366f1]" />
                  <span>Reportes</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
