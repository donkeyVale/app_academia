"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClientBrowser } from "@/lib/supabase";
import { formatPyg } from "@/lib/formatters";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  checkBiometryAvailable,
  clearBiometricSession,
  isBiometricEnabled,
  setBiometricEnabled,
  storeBiometricSession,
} from "@/lib/capacitor-biometrics";

type AppRole = "super_admin" | "admin" | "coach" | "student" | null;
type RentMode = "per_student" | "per_hour" | "both";

type RentBand = {
  timeFrom: string;
  timeTo: string;
  feePerStudentOne: string;
  feePerStudentTwoPlus: string;
  validFrom: string;
};

type DatePickerFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

function parseYmd(value: string): Date | undefined {
  if (!value) return undefined;
  const parts = value.split("-");
  if (parts.length !== 3) return undefined;
  const [y, m, d] = parts.map((p) => Number(p));
  if (!y || !m || !d) return undefined;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

function formatYmd(date: Date | undefined): string {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplay(date: Date | undefined): string {
  if (!date) return "Seleccionar fecha";
  return date.toLocaleDateString("es-PY");
}

function DatePickerField({ value, onChange }: DatePickerFieldProps) {
  const selectedDate = parseYmd(value);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start text-left text-base font-normal flex items-center gap-2 h-10"
        >
          <CalendarIcon className="h-4 w-4 text-gray-500" />
          <span className={selectedDate ? "" : "text-gray-400"}>{formatDisplay(selectedDate)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            if (!date) return;
            onChange(formatYmd(date));
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export default function SettingsPage() {
  const supabase = createClientBrowser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifyClasses, setNotifyClasses] = useState<boolean>(true);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricSaving, setBiometricSaving] = useState(false);
  const [role, setRole] = useState<AppRole>(null);
  const [academyOptions, setAcademyOptions] = useState<{ id: string; name: string }[]>([]);
  const [selectedAcademyId, setSelectedAcademyId] = useState<string | null>(null);
  const [academySelectOpen, setAcademySelectOpen] = useState(false);
  const [academySelectQuery, setAcademySelectQuery] = useState("");
  const academySelectSearchRef = useRef<HTMLInputElement | null>(null);
  const [rentMode, setRentMode] = useState<RentMode>("per_student");
  const [rentModeSaving, setRentModeSaving] = useState(false);
  const [rentModeError, setRentModeError] = useState<string | null>(null);

  useEffect(() => {
    if (!academySelectOpen) return;
    const t = window.setTimeout(() => academySelectSearchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [academySelectOpen]);

  useEffect(() => {
    (async () => {
      const enabled = isBiometricEnabled();
      setBiometricEnabledState(enabled);
      if (!enabled) {
        setBiometricAvailable(false);
        return;
      }
      const avail = await checkBiometryAvailable();
      setBiometricAvailable(!!avail.isAvailable);
    })();
  }, []);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [rentLoading, setRentLoading] = useState(false);
  const [rentSaving, setRentSaving] = useState(false);
  const [rentError, setRentError] = useState<string | null>(null);
  const [rentLocations, setRentLocations] = useState<{ id: string; name: string | null }[]>([]);
  const [rentCourts, setRentCourts] = useState<{ id: string; name: string | null; location_id: string | null }[]>([]);
  const [rentLocationValues, setRentLocationValues] = useState<
    Record<string, { feePerClass: string; validFrom: string }>
  >({});
  const [rentCourtValues, setRentCourtValues] = useState<
    Record<string, { feePerClass: string; validFrom: string }>
  >({});
  const [rentOpenLocations, setRentOpenLocations] = useState<Record<string, boolean>>({});

  const [rentLocationBands, setRentLocationBands] = useState<Record<string, RentBand[]>>({});
  const [rentCourtBands, setRentCourtBands] = useState<Record<string, RentBand[]>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        setLoading(false);
        return;
      }

      setCurrentUserId(user.id);

      try {
        const { data: profile, error: profErr } = await supabase
          .from("profiles")
          .select("notifications_enabled, role")
          .eq("id", user.id)
          .maybeSingle();

        if (profErr) throw profErr;

        if (profile && typeof profile.notifications_enabled === "boolean") {
          setNotifyClasses(profile.notifications_enabled);
        } else {
          setNotifyClasses(true);
        }

        const r = (profile?.role as AppRole) ?? null;
        if (r === "super_admin" || r === "admin" || r === "coach" || r === "student") {
          setRole(r);
        } else {
          setRole(null);
        }

        // Cargar academias asignadas al usuario (para seleccionar academia actual)
        try {
          const { data: uaRows, error: uaErr } = await supabase
            .from("user_academies")
            .select("academy_id")
            .eq("user_id", user.id);

          if (!uaErr && uaRows) {
            const academyIds = Array.from(
              new Set(
                (uaRows as { academy_id: string | null }[])
                  .map((row) => row.academy_id)
                  .filter((id): id is string => !!id)
              )
            );

            if (academyIds.length > 0) {
              const { data: acadRows, error: acadErr } = await supabase
                .from("academies")
                .select("id,name")
                .in("id", academyIds)
                .order("name");

              if (!acadErr && acadRows) {
                const options = (acadRows as { id: string; name: string | null }[]).map((a) => ({
                  id: a.id,
                  name: a.name ?? a.id,
                }));
                setAcademyOptions(options);

                let stored: string | null = null;
                if (typeof window !== "undefined") {
                  stored = window.localStorage.getItem("selectedAcademyId");
                }
                const validIds = options.map((o) => o.id);
                const initial = stored && validIds.includes(stored) ? stored : validIds[0] ?? null;
                setSelectedAcademyId(initial);
                if (initial && typeof window !== "undefined") {
                  window.localStorage.setItem("selectedAcademyId", initial);
                }
              }
            } else {
              setAcademyOptions([]);
              setSelectedAcademyId(null);
            }
          }
        } catch {
          setAcademyOptions([]);
        }
      } catch (err: any) {
        setError(err?.message ?? "Error cargando configuración.");
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  useEffect(() => {
    (async () => {
      setRentError(null);
      if (!currentUserId) return;
      if (role !== 'admin' && role !== 'super_admin') return;
      if (!selectedAcademyId) {
        setRentMode("per_student");
        setRentModeError(null);
        setRentLocations([]);
        setRentCourts([]);
        setRentLocationValues({});
        setRentCourtValues({});
        setRentLocationBands({});
        setRentCourtBands({});
        return;
      }

      setRentLoading(true);
      try {
        setRentModeError(null);
        // Cargar modo de alquiler de la academia
        try {
          const { data: acadRow, error: acadErr } = await supabase
            .from('academies')
            .select('rent_mode')
            .eq('id', selectedAcademyId)
            .maybeSingle();

          if (acadErr) throw acadErr;

          const mode = (acadRow as any)?.rent_mode as RentMode | null | undefined;
          if (mode === 'per_student' || mode === 'per_hour' || mode === 'both') {
            setRentMode(mode);
          } else {
            setRentMode('per_student');
          }
        } catch {
          setRentMode('per_student');
        }

        const { data: alRows, error: alErr } = await supabase
          .from('academy_locations')
          .select('location_id')
          .eq('academy_id', selectedAcademyId);

        if (alErr) throw alErr;

        const locationIds = Array.from(
          new Set(
            (alRows ?? [])
              .map((r: any) => (r?.location_id as string | null) ?? null)
              .filter((id: string | null): id is string => !!id),
          ),
        );

        if (locationIds.length === 0) {
          setRentLocations([]);
          setRentCourts([]);
          setRentLocationValues({});
          setRentCourtValues({});
          return;
        }

        const [locRes, courtsRes] = await Promise.all([
          supabase.from('locations').select('id,name').in('id', locationIds).order('name'),
          supabase.from('courts').select('id,name,location_id').in('location_id', locationIds).order('name'),
        ]);

        if (locRes.error) throw locRes.error;
        if (courtsRes.error) throw courtsRes.error;

        const locs = (locRes.data ?? []) as { id: string; name: string | null }[];
        const courts = (courtsRes.data ?? []) as { id: string; name: string | null; location_id: string | null }[];
        setRentLocations(locs);
        setRentCourts(courts);

        setRentOpenLocations((prev) => {
          const next: Record<string, boolean> = { ...prev };
          for (const l of locs) {
            if (typeof next[l.id] !== 'boolean') {
              next[l.id] = false;
            }
          }
          return next;
        });

        const feesRes = await fetch('/api/admin/get-rent-fees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentUserId, academyId: selectedAcademyId }),
        });

        if (!feesRes.ok) {
          const txt = await feesRes.text().catch(() => '');
          throw new Error(txt || 'No se pudo cargar la configuración de alquiler.');
        }

        const feesJson = (await feesRes.json().catch(() => null)) as any;
        const locationFees = (feesJson?.locationFees ?? []) as any[];
        const courtFees = (feesJson?.courtFees ?? []) as any[];
        const locationFeesPerStudent = (feesJson?.locationFeesPerStudent ?? []) as any[];
        const courtFeesPerStudent = (feesJson?.courtFeesPerStudent ?? []) as any[];

        const nextLocValues: Record<string, { feePerClass: string; validFrom: string }> = {};
        for (const l of locs) {
          const match = locationFees.find((x) => x.location_id === l.id);
          nextLocValues[l.id] = {
            feePerClass: match?.fee_per_class != null ? String(match.fee_per_class) : '',
            validFrom: match?.valid_from ? String(match.valid_from) : new Date().toISOString().slice(0, 10),
          };
        }

        const nextCourtValues: Record<string, { feePerClass: string; validFrom: string }> = {};
        for (const c of courts) {
          const match = courtFees.find((x) => x.court_id === c.id);
          nextCourtValues[c.id] = {
            feePerClass: match?.fee_per_class != null ? String(match.fee_per_class) : '',
            validFrom: match?.valid_from ? String(match.valid_from) : new Date().toISOString().slice(0, 10),
          };
        }

        setRentLocationValues(nextLocValues);
        setRentCourtValues(nextCourtValues);

        const nextLocBands: Record<string, RentBand[]> = {};
        for (const l of locs) {
          const bands = locationFeesPerStudent
            .filter((x) => x.location_id === l.id)
            .map((x) => ({
              timeFrom: String(x.time_from ?? '').slice(0, 5),
              timeTo: String(x.time_to ?? '').slice(0, 5),
              feePerStudentOne:
                x.fee_per_student_one != null
                  ? String(x.fee_per_student_one)
                  : x.fee_per_student != null
                    ? String(x.fee_per_student)
                    : '',
              feePerStudentTwoPlus:
                x.fee_per_student_two_plus != null
                  ? String(x.fee_per_student_two_plus)
                  : x.fee_per_student != null
                    ? String(x.fee_per_student)
                    : '',
              validFrom: x.valid_from ? String(x.valid_from) : new Date().toISOString().slice(0, 10),
            }))
            .filter((b) => !!b.timeFrom && !!b.timeTo);
          nextLocBands[l.id] = bands;
        }

        const nextCourtBands: Record<string, RentBand[]> = {};
        for (const c of courts) {
          const bands = courtFeesPerStudent
            .filter((x) => x.court_id === c.id)
            .map((x) => ({
              timeFrom: String(x.time_from ?? '').slice(0, 5),
              timeTo: String(x.time_to ?? '').slice(0, 5),
              feePerStudentOne:
                x.fee_per_student_one != null
                  ? String(x.fee_per_student_one)
                  : x.fee_per_student != null
                    ? String(x.fee_per_student)
                    : '',
              feePerStudentTwoPlus:
                x.fee_per_student_two_plus != null
                  ? String(x.fee_per_student_two_plus)
                  : x.fee_per_student != null
                    ? String(x.fee_per_student)
                    : '',
              validFrom: x.valid_from ? String(x.valid_from) : new Date().toISOString().slice(0, 10),
            }))
            .filter((b) => !!b.timeFrom && !!b.timeTo);
          nextCourtBands[c.id] = bands;
        }

        setRentLocationBands(nextLocBands);
        setRentCourtBands(nextCourtBands);
    } catch (e: any) {
      setRentError(e?.message ?? 'Error cargando configuración de alquiler.');
    } finally {
      setRentLoading(false);
    }
  })();
}, [currentUserId, role, selectedAcademyId, supabase]);

const onSaveRentMode = async (nextMode: RentMode) => {
  if (!currentUserId) return;
  if (role !== 'admin' && role !== 'super_admin') return;
  if (!selectedAcademyId) return;

  setRentModeSaving(true);
  setRentModeError(null);
  try {
    const res = await fetch('/api/admin/update-rent-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentUserId,
        academyId: selectedAcademyId,
        rentMode: nextMode,
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(txt || 'No se pudo guardar el modo de alquiler.');
    }

    setRentMode(nextMode);
    toast.success('Modo de cobro actualizado');
  } catch (e: any) {
    setRentModeError(e?.message ?? 'Error guardando el modo de alquiler.');
    toast.error(e?.message ?? 'Error guardando el modo de alquiler.');
  } finally {
    setRentModeSaving(false);
  }
};

const onSaveRentFees = async () => {
  if (!currentUserId) return;
  if (role !== 'admin' && role !== 'super_admin') return;
  if (!selectedAcademyId) return;

  setRentSaving(true);
  setRentError(null);
  try {
    const locationFeesPayload = Object.entries(rentLocationValues)
      .map(([locationId, v]) => ({
        locationId,
        feePerClass: Number(v.feePerClass),
        validFrom: v.validFrom,
      }))
      .filter((x) => Number.isFinite(x.feePerClass) && x.feePerClass >= 0 && !!x.validFrom);

    const courtFeesPayload = Object.entries(rentCourtValues)
      .map(([courtId, v]) => ({
        courtId,
        feePerClass: Number(v.feePerClass),
        validFrom: v.validFrom,
      }))
      .filter((x) => Number.isFinite(x.feePerClass) && x.feePerClass >= 0 && !!x.validFrom);

    const locationFeesPerStudentPayload = Object.entries(rentLocationBands)
      .flatMap(([locationId, bands]) =>
        (bands ?? []).map((b) => ({
          locationId,
          feePerStudent: Number(b.feePerStudentOne),
          feePerStudentOne: Number(b.feePerStudentOne),
          feePerStudentTwoPlus: Number(b.feePerStudentTwoPlus),
          validFrom: b.validFrom,
          timeFrom: b.timeFrom,
          timeTo: b.timeTo,
        })),
      )
      .filter(
        (row) =>
          !!row.locationId &&
          !!row.validFrom &&
          !!row.timeFrom &&
          !!row.timeTo &&
          !Number.isNaN(row.feePerStudentOne) &&
          !Number.isNaN(row.feePerStudentTwoPlus),
      );

    const courtFeesPerStudentPayload = Object.entries(rentCourtBands)
      .flatMap(([courtId, bands]) =>
        (bands ?? []).map((b) => ({
          courtId,
          feePerStudent: Number(b.feePerStudentOne),
          feePerStudentOne: Number(b.feePerStudentOne),
          feePerStudentTwoPlus: Number(b.feePerStudentTwoPlus),
          validFrom: b.validFrom,
          timeFrom: b.timeFrom,
          timeTo: b.timeTo,
        })),
      )
      .filter(
        (row) =>
          !!row.courtId &&
          !!row.validFrom &&
          !!row.timeFrom &&
          !!row.timeTo &&
          !Number.isNaN(row.feePerStudentOne) &&
          !Number.isNaN(row.feePerStudentTwoPlus),
      );

    const feesRes = await fetch('/api/admin/update-rent-fees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentUserId,
        academyId: selectedAcademyId,
        locationFees: rentMode === 'per_hour' || rentMode === 'both' ? locationFeesPayload : [],
        courtFees: rentMode === 'per_hour' || rentMode === 'both' ? courtFeesPayload : [],
        locationFeesPerStudent:
          rentMode === 'per_student' || rentMode === 'both' ? locationFeesPerStudentPayload : [],
        courtFeesPerStudent:
          rentMode === 'per_student' || rentMode === 'both' ? courtFeesPerStudentPayload : [],
      }),
    });

    if (!feesRes.ok) {
      const txt = await feesRes.text().catch(() => '');
      throw new Error(txt || 'No se pudo guardar la configuración de alquiler.');
    }

    toast.success('Configuración de alquiler guardada');
  } catch (e: any) {
    setRentError(e?.message ?? 'Error guardando configuración de alquiler.');
    toast.error(e?.message ?? 'Error guardando configuración de alquiler.');
  } finally {
    setRentSaving(false);
  }
};

  const onToggleNotify = async () => {
    setSaving(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        setSaving(false);
        return;
      }

      const nextValue = !notifyClasses;
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ notifications_enabled: nextValue })
        .eq("id", user.id);

      if (updErr) throw updErr;
      setNotifyClasses(nextValue);
    } catch (err: any) {
      setError(err?.message ?? "No se pudo actualizar tu configuración.");
    } finally {
      setSaving(false);
    }
  };

  const onToggleBiometric = async () => {
    if (biometricSaving) return;
    setBiometricSaving(true);
    try {
      const nextValue = !biometricEnabled;
      if (!nextValue) {
        setBiometricEnabled(false);
        setBiometricEnabledState(false);
        setBiometricAvailable(false);
        try {
          await clearBiometricSession();
        } catch {
        }
        toast.success("Ingreso con biometría desactivado");
        return;
      }

      const avail = await checkBiometryAvailable();
      if (!avail.isAvailable) {
        if (avail.reason === 'no_plugin') {
          toast.error('La app no tiene biometría habilitada en esta instalación. Reinstalá el APK.');
        } else if ((avail.reason || '').toLowerCase().includes('no biometric hardware')) {
          toast.error('Este dispositivo no tiene hardware de biometría (huella/rostro).');
        } else {
          const detail = (avail.reason || '').trim();
          toast.error(detail ? `Tu dispositivo no tiene biometría disponible: ${detail}` : 'Tu dispositivo no tiene biometría disponible.');
        }
        return;
      }

      if (avail.reason === 'device_credential') {
        toast.message('Tu dispositivo no tiene biometría compatible. Se usará el PIN/patrón del dispositivo para el ingreso rápido.');
      }

      const { data } = await supabase.auth.getSession();
      const s = data?.session;
      if (!s?.access_token || !s?.refresh_token) {
        toast.error("No se pudo obtener tu sesión actual.");
        return;
      }

      await storeBiometricSession({ access_token: s.access_token, refresh_token: s.refresh_token });
      setBiometricEnabled(true);
      setBiometricEnabledState(true);
      setBiometricAvailable(true);
      toast.success("Ingreso con biometría activado");
    } catch (err: any) {
      const msg = err?.message ?? "No se pudo actualizar biometría.";
      toast.error(msg);
    } finally {
      setBiometricSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="mt-4 space-y-6 max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-2">
            <Bell className="h-5 w-5 text-[#3cadaf] flex-shrink-0" />
            <div className="space-y-0.5">
              <h1 className="text-2xl font-semibold text-[#31435d]">Configuración</h1>
              <p className="text-sm text-gray-600">Cargando tu configuración...</p>
            </div>
          </div>
          <div className="flex items-center justify-end flex-1">
            <div className="h-16 w-32 relative opacity-60">
              <Image
                src="/icons/logoHome.png"
                alt="Agendo"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-4 space-y-6 max-w-5xl mx-auto px-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2">
          <Bell className="h-5 w-5 text-[#3cadaf] flex-shrink-0" />
          <div className="space-y-0.5">
            <h1 className="text-2xl font-semibold text-[#31435d]">Configuración</h1>
            <p className="text-sm text-gray-600">Ajustá cómo querés recibir notificaciones.</p>
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

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="border rounded-lg bg-white shadow-sm border-t-4 border-[#3cadaf]">
        <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg">
          <p className="text-sm font-semibold text-[#31435d]">Notificaciones</p>
        </div>
        <div className="px-4 py-4 space-y-4 text-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-[#31435d]">Recordatorios de clases</p>
              <p className="text-xs text-gray-600 mt-0.5">
                Recibí avisos antes de tus clases y cuando una reserva sea cancelada o modificada.
              </p>
            </div>
            <button
              type="button"
              onClick={onToggleNotify}
              disabled={loading || saving}
              className={
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                (notifyClasses
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100")
              }
            >
              {notifyClasses ? (
                <>
                  <Bell className="w-3.5 h-3.5" />
                  Activadas
                </>
              ) : (
                <>
                  <BellOff className="w-3.5 h-3.5" />
                  Desactivadas
                </>
              )}
            </button>
          </div>
          {saving && <p className="text-xs text-gray-500">Guardando cambios...</p>}
        </div>
      </div>

      <div className="border rounded-lg bg-white shadow-sm border-t-4 border-slate-400">
        <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg">
          <p className="text-sm font-semibold text-[#31435d]">Seguridad</p>
        </div>
        <div className="px-4 py-4 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-[#31435d]">Ingreso con biometría</p>
              <p className="text-xs text-gray-600 mt-0.5">
                Usá huella o rostro para ingresar más rápido en este dispositivo.
              </p>
              {biometricEnabled && !biometricAvailable && (
                <p className="text-xs text-amber-700 mt-1">Biometría no disponible en este dispositivo.</p>
              )}
            </div>
            <button
              type="button"
              onClick={onToggleBiometric}
              disabled={loading || biometricSaving}
              className={
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                (biometricEnabled
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100")
              }
            >
              {biometricEnabled ? "Activado" : "Desactivado"}
            </button>
          </div>
          {biometricSaving && <p className="text-xs text-gray-500">Guardando cambios...</p>}
        </div>
      </div>

      {academyOptions.length > 1 && (
        <div className="border rounded-lg bg-white shadow-sm border-t-4 border-emerald-500">
          <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg">
            <p className="text-sm font-semibold text-[#31435d]">Academia actual</p>
          </div>
          <div className="px-4 py-4 space-y-3 text-sm">
            <p className="text-xs text-gray-600">
              Seleccioná con qué academia querés trabajar. Esta elección se usará para filtrar los datos cuando tengas varias academias asignadas.
            </p>
            <div className="flex flex-col gap-1 max-w-xs">
              <label className="text-xs font-medium text-gray-700">Academia</label>
              <Popover open={academySelectOpen} onOpenChange={setAcademySelectOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between text-xs font-normal"
                  >
                    <span className="truncate mr-2">
                      {(() => {
                        const current = academyOptions.find((a) => a.id === selectedAcademyId);
                        return current?.name ?? 'Seleccionar academia';
                      })()}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-3" align="start">
                  <div className="space-y-2">
                    <Input
                      type="text"
                      placeholder="Buscar academias..."
                      value={academySelectQuery}
                      onChange={(e) => setAcademySelectQuery(e.target.value)}
                      className="h-11 text-base"
                      ref={academySelectSearchRef}
                    />
                    <div className="max-h-52 overflow-auto border rounded-md divide-y">
                      {(() => {
                        const filtered = academyOptions.filter((a) => {
                          const t = (academySelectQuery || '').toLowerCase();
                          if (!t) return true;
                          return `${a.name || ''} ${a.id || ''}`.toLowerCase().includes(t);
                        });
                        const limited = filtered.slice(0, 50);

                        if (academyOptions.length === 0) {
                          return (
                            <div className="px-2 py-1.5 text-xs text-gray-500">No hay academias.</div>
                          );
                        }
                        if (filtered.length === 0) {
                          return (
                            <div className="px-2 py-1.5 text-xs text-gray-500">
                              No se encontraron academias con ese criterio de búsqueda.
                            </div>
                          );
                        }

                        return (
                          <>
                            {limited.map((a) => (
                              <button
                                key={a.id}
                                type="button"
                                onClick={async () => {
                                  const next = a.id || null;
                                  setSelectedAcademyId(next);
                                  setAcademySelectQuery('');
                                  setAcademySelectOpen(false);
                                  if (typeof window !== 'undefined' && next) {
                                    window.localStorage.setItem('selectedAcademyId', next);
                                    window.dispatchEvent(
                                      new CustomEvent('selectedAcademyIdChanged', { detail: { academyId: next } })
                                    );
                                  }

                                  // Guardar academia por defecto a nivel de usuario
                                  try {
                                    const { data } = await supabase.auth.getUser();
                                    const user = data.user;
                                    if (!user || !next) return;

                                    await supabase
                                      .from('profiles')
                                      .update({ default_academy_id: next })
                                      .eq('id', user.id);
                                  } catch (err) {
                                    console.error('No se pudo actualizar default_academy_id', err);
                                  }
                                }}
                                className="w-full flex items-center justify-between px-2 py-1.5 text-sm hover:bg-slate-50"
                              >
                                <span className="mr-2 truncate">{a.name}</span>
                              </button>
                            ))}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      )}

      {role === "super_admin" && (
        <div className="border rounded-lg bg-white shadow-sm border-t-4 border-indigo-500">
          <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg">
            <p className="text-sm font-semibold text-[#31435d]">Configuración avanzada (super admin)</p>
          </div>
          <div className="px-4 py-4 space-y-3 text-sm">
            <p className="text-xs text-gray-600">
              Gestioná las academias y las asignaciones de usuarios a academias.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/super-admin/academias"
                className="inline-flex items-center rounded-md bg-[#3cadaf] px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-[#34989e]"
              >
                Administrar academias
              </Link>
              <Link
                href="/super-admin/asignaciones"
                className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700"
              >
                Asignar academias a usuarios
              </Link>
              <Link
                href="/super-admin/locations"
                className="inline-flex items-center rounded-md bg-slate-700 px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-slate-800"
              >
                Sedes y canchas
              </Link>
              <Link
                href="/super-admin/billing"
                className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-emerald-700"
              >
                Facturación Agendo
              </Link>
            </div>
          </div>
        </div>
      )}

      {(role === 'admin' || role === 'super_admin') && (
        <div className="border rounded-lg bg-white shadow-sm border-t-4 border-emerald-500">
          <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#31435d]">Alquiler de canchas (egresos)</p>
              <p className="text-xs text-gray-600 mt-0.5">
                Configurá el costo por clase (60 min) que la academia paga al complejo. Se aplica solo si hubo al menos 1 alumno.
              </p>
            </div>
            <button
              type="button"
              onClick={onSaveRentFees}
              disabled={rentSaving || rentLoading || !selectedAcademyId}
              className="inline-flex items-center rounded-md bg-[#3cadaf] px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-[#34989e] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {rentSaving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>

          <div className="px-4 py-4 space-y-3 text-sm">
            {rentError && <p className="text-xs text-red-600">{rentError}</p>}
            {rentModeError && <p className="text-xs text-red-600">{rentModeError}</p>}

            <div className="flex flex-col gap-1 max-w-xs">
              <label className="text-xs font-medium text-gray-700">Modo de cobro del complejo</label>
              <select
                value={rentMode}
                onChange={(e) => {
                  const v = (e.target.value as RentMode) ?? 'per_student';
                  onSaveRentMode(v);
                }}
                disabled={rentModeSaving || rentLoading || !selectedAcademyId}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#3cadaf] focus:border-[#3cadaf] bg-white disabled:opacity-60"
              >
                <option value="per_student">Por alumno por clase (recomendado)</option>
                <option value="per_hour">Por clase/hora (fijo)</option>
                <option value="both">Ambos</option>
              </select>
              <p className="text-[11px] text-gray-500">
                El modo define qué configuración se usa para calcular egresos.
              </p>
            </div>

            {!selectedAcademyId ? (
              <p className="text-xs text-gray-600">
                Seleccioná una academia en esta pantalla para configurar el alquiler.
              </p>
            ) : rentLoading ? (
              <p className="text-xs text-gray-600">Cargando sedes y canchas...</p>
            ) : rentLocations.length === 0 ? (
              <p className="text-xs text-gray-600">No hay sedes vinculadas a esta academia.</p>
            ) : rentMode === 'per_student' ? (
              <div className="space-y-4">
                {rentLocations.map((loc) => {
                  const isOpen = !!rentOpenLocations[loc.id];
                  const bands = rentLocationBands[loc.id] ?? [];
                  const courtsForLoc = rentCourts.filter((c) => c.location_id === loc.id);

                  const addLocationBand = (preset?: { timeFrom: string; timeTo: string }) => {
                    const nextBand: RentBand = {
                      timeFrom: preset?.timeFrom ?? '06:00',
                      timeTo: preset?.timeTo ?? '18:00',
                      feePerStudentOne: '',
                      feePerStudentTwoPlus: '',
                      validFrom: new Date().toISOString().slice(0, 10),
                    };

                    const exists = (rentLocationBands[loc.id] ?? []).some(
                      (b) => b.timeFrom === nextBand.timeFrom && b.timeTo === nextBand.timeTo,
                    );
                    if (exists) {
                      toast.info('Esa banda horaria ya existe en esta sede.');
                      return;
                    }
                    setRentLocationBands((prev) => ({
                      ...prev,
                      [loc.id]: [...(prev[loc.id] ?? []), nextBand],
                    }));

                    if (preset) {
                      toast.success(`Banda agregada (${nextBand.timeFrom}–${nextBand.timeTo})`);
                    } else {
                      toast.success('Banda manual agregada');
                    }
                  };

                  return (
                    <div key={loc.id} className="border rounded-md p-3">
                      <button
                        type="button"
                        onClick={() =>
                          setRentOpenLocations((prev) => ({
                            ...prev,
                            [loc.id]: !prev[loc.id],
                          }))
                        }
                        className="w-full flex items-center justify-between gap-3 text-left"
                      >
                        <div className="flex items-center gap-2">
                          {isOpen ? (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          )}
                          <div>
                            <p className="text-sm font-semibold text-[#31435d]">{loc.name ?? loc.id}</p>
                            <p className="text-xs text-gray-500">Canchas: {courtsForLoc.length}</p>
                          </div>
                        </div>
                        <div className="text-xs text-gray-600">Bandas: {bands.length}</div>
                      </button>

                      {isOpen && (
                        <div className="mt-3 space-y-3">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => addLocationBand({ timeFrom: '06:00', timeTo: '18:00' })}
                              className="h-9"
                            >
                              Agregar horas muertas (06–18)
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => addLocationBand({ timeFrom: '18:00', timeTo: '23:00' })}
                              className="h-9"
                            >
                              Agregar horas pico (18–23)
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => addLocationBand()}
                              className="h-9"
                            >
                              Agregar banda manual
                            </Button>
                          </div>

                          {bands.length === 0 ? (
                            <p className="text-xs text-gray-600">Sin bandas configuradas para esta sede.</p>
                          ) : (
                            <div className="space-y-2">
                              {bands.map((b, idx) => (
                                <div key={`${loc.id}-${idx}`} className="border rounded-md p-2">
                                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    <div className="flex flex-col gap-1">
                                      <label className="text-sm text-gray-600">Desde</label>
                                      <Input
                                        type="time"
                                        value={b.timeFrom}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          setRentLocationBands((prev) => {
                                            const next = [...(prev[loc.id] ?? [])];
                                            next[idx] = { ...next[idx], timeFrom: v };
                                            return { ...prev, [loc.id]: next };
                                          });
                                        }}
                                        className="h-10 text-base"
                                      />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <label className="text-sm text-gray-600">Hasta</label>
                                      <Input
                                        type="time"
                                        value={b.timeTo}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          setRentLocationBands((prev) => {
                                            const next = [...(prev[loc.id] ?? [])];
                                            next[idx] = { ...next[idx], timeTo: v };
                                            return { ...prev, [loc.id]: next };
                                          });
                                        }}
                                        className="h-10 text-base"
                                      />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <label className="text-sm text-gray-600">Vigente desde</label>
                                      <DatePickerField
                                        value={b.validFrom}
                                        onChange={(value) => {
                                          setRentLocationBands((prev) => {
                                            const next = [...(prev[loc.id] ?? [])];
                                            next[idx] = { ...next[idx], validFrom: value };
                                            return { ...prev, [loc.id]: next };
                                          });
                                        }}
                                      />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <label className="text-sm text-gray-600">Monto 1 alumno</label>
                                      <Input
                                        type="number"
                                        inputMode="decimal"
                                        value={b.feePerStudentOne}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          setRentLocationBands((prev) => {
                                            const next = [...(prev[loc.id] ?? [])];
                                            next[idx] = { ...next[idx], feePerStudentOne: v };
                                            return { ...prev, [loc.id]: next };
                                          });
                                        }}
                                        className="h-10 text-base"
                                        placeholder="0"
                                      />
                                      {b.feePerStudentOne !== '' && Number.isFinite(Number(b.feePerStudentOne)) && (
                                        <p className="text-[11px] text-gray-500">{formatPyg(Number(b.feePerStudentOne))} PYG</p>
                                      )}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <label className="text-sm text-gray-600">Monto 2+ alumnos</label>
                                      <Input
                                        type="number"
                                        inputMode="decimal"
                                        value={b.feePerStudentTwoPlus}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          setRentLocationBands((prev) => {
                                            const next = [...(prev[loc.id] ?? [])];
                                            next[idx] = { ...next[idx], feePerStudentTwoPlus: v };
                                            return { ...prev, [loc.id]: next };
                                          });
                                        }}
                                        className="h-10 text-base"
                                        placeholder="0"
                                      />
                                      {b.feePerStudentTwoPlus !== '' && Number.isFinite(Number(b.feePerStudentTwoPlus)) && (
                                        <p className="text-[11px] text-gray-500">{formatPyg(Number(b.feePerStudentTwoPlus))} PYG</p>
                                      )}
                                    </div>
                                  </div>

                                  <div className="mt-2 flex justify-end">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => {
                                        setRentLocationBands((prev) => {
                                          const next = [...(prev[loc.id] ?? [])];
                                          next.splice(idx, 1);
                                          return { ...prev, [loc.id]: next };
                                        });
                                        toast.success('Banda eliminada (pendiente de guardar)');
                                      }}
                                      className="h-9"
                                    >
                                      Quitar
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {courtsForLoc.length > 0 && (
                            <div className="mt-3 space-y-2">
                              <p className="text-sm font-semibold text-gray-700">Overrides por cancha (opcional)</p>
                              <div className="space-y-2">
                                {courtsForLoc.map((c) => {
                                  const courtBands = rentCourtBands[c.id] ?? [];

                                  const addCourtBand = (preset?: { timeFrom: string; timeTo: string }) => {
                                    const nextBand: RentBand = {
                                      timeFrom: preset?.timeFrom ?? '06:00',
                                      timeTo: preset?.timeTo ?? '18:00',
                                      feePerStudentOne: '',
                                      feePerStudentTwoPlus: '',
                                      validFrom: new Date().toISOString().slice(0, 10),
                                    };

                                    const exists = (rentCourtBands[c.id] ?? []).some(
                                      (b) => b.timeFrom === nextBand.timeFrom && b.timeTo === nextBand.timeTo,
                                    );
                                    if (exists) {
                                      toast.info('Esa banda horaria ya existe en esta cancha.');
                                      return;
                                    }
                                    setRentCourtBands((prev) => ({
                                      ...prev,
                                      [c.id]: [...(prev[c.id] ?? []), nextBand],
                                    }));

                                    if (preset) {
                                      toast.success(`Override agregado (${nextBand.timeFrom}–${nextBand.timeTo})`);
                                    } else {
                                      toast.success('Override manual agregado');
                                    }
                                  };

                                  return (
                                    <div key={c.id} className="border rounded-md p-2">
                                      <p className="text-sm font-medium text-[#31435d]">{c.name ?? c.id}</p>

                                      <div className="mt-2 flex flex-wrap gap-2">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          onClick={() => addCourtBand({ timeFrom: '06:00', timeTo: '18:00' })}
                                          className="h-9"
                                        >
                                          Horas muertas
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          onClick={() => addCourtBand({ timeFrom: '18:00', timeTo: '23:00' })}
                                          className="h-9"
                                        >
                                          Horas pico
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          onClick={() => addCourtBand()}
                                          className="h-9"
                                        >
                                          Banda manual
                                        </Button>
                                      </div>

                                      {courtBands.length === 0 ? (
                                        <p className="mt-2 text-xs text-gray-600">Sin overrides configurados.</p>
                                      ) : (
                                        <div className="mt-2 space-y-2">
                                          {courtBands.map((b, idx) => (
                                            <div key={`${c.id}-${idx}`} className="border rounded-md p-2">
                                              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                                <div className="flex flex-col gap-1">
                                                  <label className="text-sm text-gray-600">Desde</label>
                                                  <Input
                                                    type="time"
                                                    value={b.timeFrom}
                                                    onChange={(e) => {
                                                      const v = e.target.value;
                                                      setRentCourtBands((prev) => {
                                                        const next = [...(prev[c.id] ?? [])];
                                                        next[idx] = { ...next[idx], timeFrom: v };
                                                        return { ...prev, [c.id]: next };
                                                      });
                                                    }}
                                                    className="h-10 text-base"
                                                  />
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                  <label className="text-sm text-gray-600">Hasta</label>
                                                  <Input
                                                    type="time"
                                                    value={b.timeTo}
                                                    onChange={(e) => {
                                                      const v = e.target.value;
                                                      setRentCourtBands((prev) => {
                                                        const next = [...(prev[c.id] ?? [])];
                                                        next[idx] = { ...next[idx], timeTo: v };
                                                        return { ...prev, [c.id]: next };
                                                      });
                                                    }}
                                                    className="h-10 text-base"
                                                  />
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                  <label className="text-sm text-gray-600">Vigente desde</label>
                                                  <DatePickerField
                                                    value={b.validFrom}
                                                    onChange={(value) => {
                                                      setRentCourtBands((prev) => {
                                                        const next = [...(prev[c.id] ?? [])];
                                                        next[idx] = { ...next[idx], validFrom: value };
                                                        return { ...prev, [c.id]: next };
                                                      });
                                                    }}
                                                  />
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                  <label className="text-sm text-gray-600">Monto 1 alumno</label>
                                                  <Input
                                                    type="number"
                                                    inputMode="decimal"
                                                    value={b.feePerStudentOne}
                                                    onChange={(e) => {
                                                      const v = e.target.value;
                                                      setRentCourtBands((prev) => {
                                                        const next = [...(prev[c.id] ?? [])];
                                                        next[idx] = { ...next[idx], feePerStudentOne: v };
                                                        return { ...prev, [c.id]: next };
                                                      });
                                                    }}
                                                    className="h-10 text-base"
                                                    placeholder="0"
                                                  />
                                                  {b.feePerStudentOne !== '' && Number.isFinite(Number(b.feePerStudentOne)) && (
                                                    <p className="text-[11px] text-gray-500">{formatPyg(Number(b.feePerStudentOne))} PYG</p>
                                                  )}
                                                </div>
                                              </div>
                                              <div className="flex flex-col gap-1">
                                                <label className="text-sm text-gray-600">Monto 2+ alumnos</label>
                                                <Input
                                                  type="number"
                                                  inputMode="decimal"
                                                  value={b.feePerStudentTwoPlus}
                                                  onChange={(e) => {
                                                    const v = e.target.value;
                                                    setRentCourtBands((prev) => {
                                                      const next = [...(prev[c.id] ?? [])];
                                                      next[idx] = { ...next[idx], feePerStudentTwoPlus: v };
                                                      return { ...prev, [c.id]: next };
                                                    });
                                                  }}
                                                  className="h-10 text-base"
                                                  placeholder="0"
                                                />
                                                {b.feePerStudentTwoPlus !== '' && Number.isFinite(Number(b.feePerStudentTwoPlus)) && (
                                                  <p className="text-[11px] text-gray-500">{formatPyg(Number(b.feePerStudentTwoPlus))} PYG</p>
                                                )}
                                              </div>

                                              <div className="mt-2 flex justify-end">
                                                <Button
                                                  type="button"
                                                  variant="outline"
                                                  onClick={() => {
                                                    setRentCourtBands((prev) => {
                                                      const next = [...(prev[c.id] ?? [])];
                                                      next.splice(idx, 1);
                                                      return { ...prev, [c.id]: next };
                                                    });
                                                    toast.success('Override eliminado (pendiente de guardar)');
                                                  }}
                                                  className="h-9"
                                                >
                                                  Quitar
                                                </Button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              // per_hour o both: mostrar configuración actual por clase
              <div className="space-y-4">
                {rentLocations.map((loc) => {
                  const locValue = rentLocationValues[loc.id] ?? {
                    feePerClass: '',
                    validFrom: new Date().toISOString().slice(0, 10),
                  };
                  const courtsForLoc = rentCourts.filter((c) => c.location_id === loc.id);
                  const isOpen = !!rentOpenLocations[loc.id];

                  return (
                    <div key={loc.id} className="border rounded-md p-3">
                      <button
                        type="button"
                        onClick={() =>
                          setRentOpenLocations((prev) => ({
                            ...prev,
                            [loc.id]: !prev[loc.id],
                          }))
                        }
                        className="w-full flex items-center justify-between gap-3 text-left"
                      >
                        <div className="flex items-center gap-2">
                          {isOpen ? (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          )}
                          <div>
                            <p className="text-sm font-semibold text-[#31435d]">{loc.name ?? loc.id}</p>
                            <p className="text-xs text-gray-500">Canchas: {courtsForLoc.length}</p>
                          </div>
                        </div>
                        <div className="text-xs text-gray-600">
                          {locValue.feePerClass ? `Base: ${locValue.feePerClass} PYG` : 'Sin base'}
                        </div>
                      </button>

                      {isOpen && (
                        <div className="mt-3 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-sm text-gray-600">Vigente desde (base sede)</label>
                              <DatePickerField
                                value={locValue.validFrom}
                                onChange={(value) =>
                                  setRentLocationValues((prev) => ({
                                    ...prev,
                                    [loc.id]: { ...locValue, validFrom: value },
                                  }))
                                }
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="text-sm text-gray-600">Alquiler base por clase</label>
                              <Input
                                type="number"
                                inputMode="decimal"
                                value={locValue.feePerClass}
                                onChange={(e) =>
                                  setRentLocationValues((prev) => ({
                                    ...prev,
                                    [loc.id]: { ...prev[loc.id], feePerClass: e.target.value },
                                  }))
                                }
                                className="h-10 text-base"
                                placeholder="0"
                              />
                              {locValue.feePerClass !== '' && Number.isFinite(Number(locValue.feePerClass)) && (
                                <p className="text-[11px] text-gray-500">{formatPyg(Number(locValue.feePerClass))} PYG</p>
                              )}
                            </div>
                          </div>

                          {courtsForLoc.length > 0 && (
                            <div className="mt-1 space-y-2">
                              <p className="text-sm font-semibold text-gray-700">Overrides por cancha (opcional)</p>
                              <div className="space-y-2">
                                {courtsForLoc.map((c) => {
                                  const cValue = rentCourtValues[c.id] ?? {
                                    feePerClass: '',
                                    validFrom: new Date().toISOString().slice(0, 10),
                                  };
                                  return (
                                    <div key={c.id} className="border rounded-md p-2">
                                      <p className="text-sm font-medium text-[#31435d]">{c.name ?? c.id}</p>
                                      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="flex flex-col gap-1">
                                          <label className="text-sm text-gray-600">Vigente desde (override)</label>
                                          <DatePickerField
                                            value={cValue.validFrom}
                                            onChange={(value) =>
                                              setRentCourtValues((prev) => ({
                                                ...prev,
                                                [c.id]: { ...cValue, validFrom: value },
                                              }))
                                            }
                                          />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                          <label className="text-sm text-gray-600">Alquiler por clase</label>
                                          <Input
                                            type="number"
                                            inputMode="decimal"
                                            value={cValue.feePerClass}
                                            onChange={(e) =>
                                              setRentCourtValues((prev) => ({
                                                ...prev,
                                                [c.id]: { ...prev[c.id], feePerClass: e.target.value },
                                              }))
                                            }
                                            className="h-10 text-base"
                                            placeholder="0"
                                          />
                                          {cValue.feePerClass !== '' && Number.isFinite(Number(cValue.feePerClass)) && (
                                            <p className="text-[11px] text-gray-500">{formatPyg(Number(cValue.feePerClass))} PYG</p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
