"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { createClientBrowser } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, Download, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type AppRole = "super_admin" | "admin" | "coach" | "student" | null;

type Academy = {
  id: string;
  name: string;
};

type UserAcademyRow = {
  academy_id: string;
  user_id: string;
  role: string;
  is_active: boolean;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
};

type AcademyStudentsRow = {
  academyId: string;
  academyName: string;
  activeStudentsCount: number;
  students: { userId: string; fullName: string }[];
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function ymd(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseYmd(value: string): Date | undefined {
  if (!value) return undefined;
  const parts = value.split("-");
  if (parts.length !== 3) return undefined;
  const [y, m, d] = parts.map((p) => Number(p));
  if (!y || !m || !d) return undefined;
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return undefined;
  return dt;
}

function formatDisplayDate(value: string): string {
  const dt = parseYmd(value);
  if (!dt) return "Seleccionar";
  return dt.toLocaleDateString("es-PY");
}

async function getLogoPngInfo() {
  const res = await fetch("/icons/LogoAgendo1024.png");
  if (!res.ok) throw new Error("No se pudo cargar el logo");
  const blob = await res.blob();
  const base64: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Error leyendo logo"));
    reader.readAsDataURL(blob);
  });

  const objectUrl = URL.createObjectURL(blob);
  try {
    const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = document.createElement("img");
      img.onload = () => resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
      img.onerror = () => reject(new Error("Error cargando dimensiones del logo"));
      img.src = objectUrl;
    });
    return { base64, width, height };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function sanitizeFileName(value: string) {
  return value
    .replace(/[\\/]/g, "-")
    .replace(/[:*?\"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function SuperAdminReportsPage() {
  const supabase = useMemo(() => createClientBrowser(), []);
  const [role, setRole] = useState<AppRole>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cutoffDate, setCutoffDate] = useState<string>(() => ymd(new Date()));
  const [rows, setRows] = useState<AcademyStudentsRow[]>([]);
  const [search, setSearch] = useState("");
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingUser(true);
      setError(null);
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        if (!active) return;
        setRole(null);
        setLoadingUser(false);
        return;
      }

      try {
        const { data: profile, error: profErr } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
        if (profErr) throw profErr;
        const r = (profile?.role as AppRole) ?? null;
        setRole(r);
      } catch (e: any) {
        setError(e?.message ?? "Error cargando tu perfil.");
        setRole(null);
      } finally {
        if (!active) return;
        setLoadingUser(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [supabase]);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: academiesData, error: acadErr }, { data: uaData, error: uaErr }] = await Promise.all([
        supabase.from("academies").select("id,name").order("name"),
        supabase
          .from("user_academies")
          .select("academy_id,user_id,role,is_active")
          .eq("role", "student")
          .eq("is_active", true),
      ]);

      if (acadErr) throw acadErr;
      if (uaErr) throw uaErr;

      const academies = ((academiesData ?? []) as any[]).map((a) => ({
        id: a.id as string,
        name: (a.name as string | null) ?? (a.id as string),
      })) as Academy[];

      const academyNameById: Record<string, string> = {};
      for (const a of academies) academyNameById[a.id] = a.name ?? a.id;

      const uaRows = (uaData ?? []) as unknown as UserAcademyRow[];

      const userIds = Array.from(new Set(uaRows.map((r) => r.user_id).filter(Boolean)));
      let profilesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesErr } = await supabase.from("profiles").select("id,full_name").in("id", userIds);
        if (profilesErr) throw profilesErr;
        profilesMap = ((profilesData ?? []) as ProfileRow[]).reduce<Record<string, string>>((acc, p) => {
          acc[p.id] = (p.full_name ?? p.id) as string;
          return acc;
        }, {});
      }

      const usersByAcademy: Record<string, Set<string>> = {};
      for (const r of uaRows) {
        if (!r.academy_id || !r.user_id) continue;
        (usersByAcademy[r.academy_id] ||= new Set()).add(r.user_id);
      }

      const out: AcademyStudentsRow[] = Object.keys(usersByAcademy)
        .map((academyId) => {
          const ids = Array.from(usersByAcademy[academyId] ?? []);
          const students = ids
            .map((userId) => ({ userId, fullName: profilesMap[userId] ?? userId }))
            .sort((a, b) => a.fullName.localeCompare(b.fullName));
          return {
            academyId,
            academyName: academyNameById[academyId] ?? academyId,
            activeStudentsCount: students.length,
            students,
          };
        })
        .sort((a, b) => b.activeStudentsCount - a.activeStudentsCount);

      setRows(out);
    } catch (e: any) {
      setError(e?.message ?? "Error cargando reporte.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (role !== "super_admin") return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.academyName.toLowerCase().includes(q));
  }, [rows, search]);

  const totalActive = useMemo(() => filtered.reduce((sum, r) => sum + (r.activeStudentsCount || 0), 0), [filtered]);

  const onExportPdf = async () => {
    setExportingPdf(true);
    try {
      const logo = await getLogoPngInfo();
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

      const pageWidth = doc.internal.pageSize.getWidth();
      const marginX = 40;
      const topY = 36;

      const logoW = 44;
      const ratio = logo.height > 0 ? logo.width / logo.height : 1;
      const logoH = logoW / Math.max(ratio, 0.01);

      doc.addImage(logo.base64, "PNG", marginX, topY, logoW, logoH);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Reporte de alumnos activos por academia", marginX + 56, topY + 18);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text(`Fecha de corte: ${formatDisplayDate(cutoffDate)} (estado actual)`, marginX + 56, topY + 36);

      doc.setTextColor(30);
      doc.setFontSize(10);
      doc.text(`Total alumnos activos (según filtro): ${totalActive}`, marginX, topY + 64);

      const bodyRows = filtered.map((r) => {
        const list = r.students.map((s) => s.fullName).join("\n");
        return [r.academyName, String(r.activeStudentsCount), list];
      });

      autoTable(doc, {
        startY: topY + 78,
        head: [["Academia", "Activos", "Detalle de alumnos"]],
        body: bodyRows,
        theme: "grid",
        styles: { font: "helvetica", fontSize: 8, cellPadding: 4, overflow: "linebreak" },
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 160 },
          1: { cellWidth: 50, halign: "right" },
          2: { cellWidth: pageWidth - marginX * 2 - 210 },
        },
        didDrawPage: (data) => {
          const page = doc.getNumberOfPages();
          doc.setFontSize(9);
          doc.setTextColor(120);
          doc.text(`Agendo · Reportes Super Admin · Página ${page}`, marginX, doc.internal.pageSize.getHeight() - 28);
        },
      });

      const fileName = sanitizeFileName(`Agendo - Reporte Alumnos activos por academia - ${cutoffDate}.pdf`);
      doc.save(fileName);
      toast.success("PDF generado.");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo exportar PDF.");
    } finally {
      setExportingPdf(false);
    }
  };

  if (loadingUser) {
    return (
      <section className="max-w-5xl mx-auto px-4 py-6">
        <div className="text-sm text-gray-500">Cargando...</div>
      </section>
    );
  }

  if (role !== "super_admin") {
    return (
      <section className="max-w-5xl mx-auto px-4 py-6">
        <div className="border rounded-lg bg-white p-4">
          <div className="text-sm font-semibold text-[#0f172a]">No autorizado</div>
          <div className="text-xs text-gray-600 mt-1">Esta sección es exclusiva para Super Admin.</div>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-6xl mx-auto px-4 py-6 space-y-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 160px)" }}>
      <div className="flex items-start justify-between gap-3 flex-col sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold text-[#0f172a]">Reportes (Super Admin)</h1>
          <p className="text-sm text-gray-600">Alumnos activos por academia (estado actual).</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" disabled={loading} onClick={reload}>
            <RefreshCcw className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
          <Button type="button" disabled={exportingPdf || filtered.length === 0} onClick={onExportPdf}>
            <Download className="w-4 h-4 mr-2" />
            {exportingPdf ? "Generando..." : "Exportar PDF"}
          </Button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="border rounded-lg bg-white p-3">
          <div className="text-xs text-gray-500">Fecha de corte</div>
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="w-full justify-start text-left text-sm font-normal flex items-center gap-2 mt-1">
                <CalendarIcon className="h-4 w-4 text-gray-500" />
                <span className={cutoffDate ? "" : "text-gray-400"}>{formatDisplayDate(cutoffDate)}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0" align="start">
              <Calendar
                mode="single"
                selected={parseYmd(cutoffDate)}
                onSelect={(date) => {
                  if (!date) return;
                  setCutoffDate(ymd(date));
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <div className="text-[11px] text-gray-500 mt-2">La fecha es referencial; el conteo es el estado actual.</div>
        </div>

        <div className="border rounded-lg bg-white p-3 md:col-span-2">
          <div className="text-xs text-gray-500">Buscar academia</div>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ej: Central" className="mt-1" />
          <div className="text-[11px] text-gray-500 mt-2">Academias: {filtered.length} · Total alumnos activos: {totalActive}</div>
        </div>
      </div>

      <div className="border rounded-lg bg-white overflow-hidden">
        <div className="px-3 py-2 border-b bg-gray-50 flex items-center justify-between">
          <div className="text-sm font-semibold text-[#31435d]">Detalle por academia</div>
          {loading && <div className="text-xs text-gray-500">Cargando...</div>}
        </div>

        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-sm text-gray-500">No hay datos para mostrar.</div>
        ) : (
          <div className="divide-y">
            {filtered.map((r) => (
              <details key={r.academyId} className="px-3 py-2">
                <summary className="cursor-pointer flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-slate-900/5 flex items-center justify-center overflow-hidden">
                      <Image src="/icons/LogoAgendo1024.png" alt="Agendo" width={24} height={24} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[#0f172a]">{r.academyName}</div>
                      <div className="text-[11px] text-gray-500">{r.activeStudentsCount} alumnos activos</div>
                    </div>
                  </div>
                  <div className="text-xs font-semibold tabular-nums text-[#0f172a]">{r.activeStudentsCount}</div>
                </summary>

                <div className="mt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {r.students.map((s) => (
                      <div key={s.userId} className="border rounded-md px-3 py-2 text-sm bg-white">
                        {s.fullName}
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
