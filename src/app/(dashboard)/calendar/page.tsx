"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { createClientBrowser } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type AppRole = "super_admin" | "admin" | "coach" | "student" | null;

type Academy = {
  id: string;
  name: string;
};

type Court = { id: string; name: string; location_id: string | null };

type Coach = { id: string; user_id: string | null; full_name?: string | null };

type ClassSession = {
  id: string;
  date: string;
  type: string;
  capacity: number;
  coach_id: string | null;
  court_id: string | null;
  status?: string | null;
  attendance_pending?: boolean | null;
};

type BookingRow = {
  id: string;
  class_id: string | null;
  student_id: string | null;
};

function toIsoSafe(d: Date): string {
  const t = d.getTime();
  if (Number.isNaN(t)) return new Date(0).toISOString();
  return new Date(t).toISOString();
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toYmd(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export default function CalendarPage() {
  const supabase = useMemo(() => createClientBrowser(), []);

  const [role, setRole] = useState<AppRole>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [academies, setAcademies] = useState<Academy[]>([]);
  const [selectedAcademyId, setSelectedAcademyId] = useState<string | null>(null);
  const [selectedAcademyReady, setSelectedAcademyReady] = useState(false);

  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const visibleRangeRef = useRef<{ start: Date; end: Date } | null>(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsEvent, setDetailsEvent] = useState<any | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDay, setRescheduleDay] = useState<string>("");
  const [rescheduleTime, setRescheduleTime] = useState<string>("");
  const [rescheduling, setRescheduling] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const uid = (data?.user?.id as string | undefined) ?? null;
        setUserId(uid);
        if (!uid) {
          setRole(null);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", uid)
          .maybeSingle();
        const r = (profile?.role as AppRole) ?? null;
        setRole(r);
      } catch {
        setUserId(null);
        setRole(null);
      }
    })();
  }, [supabase]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("selectedAcademyId");
    setSelectedAcademyId(stored && stored.trim() ? stored : null);
    setSelectedAcademyReady(true);

    const onChanged = (ev: Event) => {
      const next = (ev as CustomEvent<{ academyId: string | null }>).detail?.academyId ?? null;
      setSelectedAcademyId(next && next.trim() ? next : null);
    };
    window.addEventListener("selectedAcademyIdChanged", onChanged as any);
    return () => window.removeEventListener("selectedAcademyIdChanged", onChanged as any);
  }, []);

  useEffect(() => {
    (async () => {
      if (!userId) {
        setAcademies([]);
        return;
      }

      try {
        const { data: uaRows, error: uaErr } = await supabase
          .from("user_academies")
          .select("academy_id")
          .eq("user_id", userId);
        if (uaErr) throw uaErr;

        const academyIds = Array.from(
          new Set(((uaRows as { academy_id: string }[] | null) ?? []).map((r) => r.academy_id).filter(Boolean))
        );

        if (academyIds.length === 0) {
          setAcademies([]);
          return;
        }

        const { data: aRows, error: aErr } = await supabase
          .from("academies")
          .select("id,name")
          .in("id", academyIds)
          .order("name");
        if (aErr) throw aErr;

        const list = ((aRows as Academy[] | null) ?? []).filter((a) => a?.id);
        setAcademies(list);

        if (!selectedAcademyId && list.length > 0 && typeof window !== "undefined") {
          const first = list[0].id;
          window.localStorage.setItem("selectedAcademyId", first);
          window.dispatchEvent(new CustomEvent("selectedAcademyIdChanged", { detail: { academyId: first } }));
          setSelectedAcademyId(first);
        }
      } catch (e: any) {
        toast.error(e?.message ?? "No se pudieron cargar academias.");
        setAcademies([]);
      }
    })();
  }, [supabase, userId, selectedAcademyId]);

  const loadCalendarRange = async (start: Date, end: Date) => {
    if (!selectedAcademyReady) return;
    if (!selectedAcademyId) {
      setEvents([]);
      return;
    }

    setLoading(true);
    try {
      const { data: locRows, error: locErr } = await supabase
        .from("academy_locations")
        .select("location_id")
        .eq("academy_id", selectedAcademyId);
      if (locErr) throw locErr;

      const locationIds = Array.from(
        new Set(
          ((locRows as { location_id: string | null }[] | null) ?? [])
            .map((r) => r.location_id)
            .filter((id): id is string => !!id)
        )
      );

      if (locationIds.length === 0) {
        setEvents([]);
        return;
      }

      const { data: courtsData, error: courtsErr } = await supabase
        .from("courts")
        .select("id,name,location_id")
        .in("location_id", locationIds);
      if (courtsErr) throw courtsErr;

      const courts = ((courtsData as Court[] | null) ?? []).filter((c) => c?.id);
      const courtById = courts.reduce<Record<string, Court>>((acc, c) => {
        acc[c.id] = c;
        return acc;
      }, {});

      const courtIds = courts.map((c) => c.id);
      if (courtIds.length === 0) {
        setEvents([]);
        return;
      }

      const fromIso = toIsoSafe(start);
      const toIso = toIsoSafe(end);

      const { data: classRows, error: classErr } = await supabase
        .from("class_sessions")
        .select("id,date,type,capacity,coach_id,court_id,status,attendance_pending")
        .in("court_id", courtIds)
        .gte("date", fromIso)
        .lte("date", toIso)
        .neq("status", "cancelled")
        .order("date", { ascending: true });
      if (classErr) throw classErr;

      const classes = (classRows as ClassSession[] | null) ?? [];
      const classIds = classes.map((c) => c.id);

      let bookingsCountByClassId: Record<string, number> = {};
      if (classIds.length > 0) {
        const { data: bRows, error: bErr } = await supabase
          .from("bookings")
          .select("id,class_id,student_id")
          .in("class_id", classIds);
        if (!bErr) {
          bookingsCountByClassId = ((bRows as BookingRow[] | null) ?? []).reduce<Record<string, number>>((acc, b) => {
            const cid = b.class_id;
            if (!cid) return acc;
            acc[cid] = (acc[cid] ?? 0) + 1;
            return acc;
          }, {});
        }
      }

      const coachIds = Array.from(
        new Set(classes.map((c) => c.coach_id).filter((id): id is string => !!id))
      );

      let coachNameByCoachId: Record<string, string | null> = {};
      if (coachIds.length > 0) {
        const { data: coachRows, error: coachErr } = await supabase
          .from("coaches")
          .select("id,user_id")
          .in("id", coachIds);
        if (!coachErr) {
          const coaches = (coachRows as Coach[] | null) ?? [];
          const userIds = Array.from(new Set(coaches.map((c) => c.user_id).filter((x): x is string => !!x)));
          let fullNameByUserId: Record<string, string | null> = {};
          if (userIds.length > 0) {
            const { data: profileRows, error: profErr } = await supabase
              .from("profiles")
              .select("id,full_name")
              .in("id", userIds);
            if (!profErr) {
              fullNameByUserId = ((profileRows as { id: string; full_name: string | null }[] | null) ?? []).reduce<
                Record<string, string | null>
              >((acc, p) => {
                acc[p.id] = p.full_name;
                return acc;
              }, {});
            }
          }

          coachNameByCoachId = coaches.reduce<Record<string, string | null>>((acc, c) => {
            const name = c.user_id ? fullNameByUserId[c.user_id] ?? null : null;
            acc[c.id] = name;
            return acc;
          }, {});
        }
      }

      const nextEvents = classes
        .map((cls) => {
          const startDt = new Date(cls.date);
          const endDt = new Date(startDt.getTime() + 60 * 60 * 1000);
          const court = cls.court_id ? courtById[cls.court_id] : null;
          const coachName = cls.coach_id ? coachNameByCoachId[cls.coach_id] ?? null : null;
          const n = bookingsCountByClassId[cls.id] ?? 0;

          const titleParts: string[] = [];
          if (court?.name) titleParts.push(court.name);
          if (coachName) titleParts.push(coachName);
          if (n > 0) titleParts.push(`${n} alumno${n === 1 ? "" : "s"}`);

          return {
            id: cls.id,
            title: titleParts.length ? titleParts.join(" · ") : "Clase",
            start: startDt,
            end: endDt,
            backgroundColor: cls.attendance_pending ? "#f59e0b" : "#3cadaf",
            borderColor: cls.attendance_pending ? "#d97706" : "#279aa0",
            textColor: "#0f172a",
            extendedProps: {
              kind: "class_session",
              classSession: cls,
              courtName: court?.name ?? null,
              coachName,
              bookingsCount: n,
            },
          };
        })
        .filter(Boolean);

      setEvents(nextEvents);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo cargar el calendario.");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const onOpenDetails = (eventApi: any) => {
    const p = (eventApi?.extendedProps ?? {}) as any;
    setDetailsEvent({
      id: eventApi?.id ?? null,
      title: eventApi?.title ?? "",
      start: eventApi?.start ?? null,
      end: eventApi?.end ?? null,
      props: p,
    });
    setDetailsOpen(true);
    setRescheduleOpen(false);

    const startDt = eventApi?.start ? new Date(eventApi.start) : null;
    if (startDt) {
      setRescheduleDay(toYmd(startDt));
      setRescheduleTime(`${pad2(startDt.getHours())}:00`);
    } else {
      setRescheduleDay("");
      setRescheduleTime("");
    }
  };

  const onConfirmReschedule = async () => {
    const p = (detailsEvent?.props ?? {}) as any;
    if (p?.kind !== "class_session") return;
    const cls = p.classSession as ClassSession | undefined;
    if (!cls?.id) return;

    if (!rescheduleDay || !rescheduleTime) {
      toast.error("Completa fecha y hora.");
      return;
    }

    const hour = Number(rescheduleTime.split(":")[0] ?? "NaN");
    if (Number.isNaN(hour) || hour < 6 || hour > 23) {
      toast.error("Horario inválido. Seleccioná una hora entre 06:00 y 23:00.");
      return;
    }

    const iso = new Date(`${rescheduleDay}T${rescheduleTime}:00`).toISOString();
    {
      const now = new Date();
      const classStart = new Date(iso);
      if (classStart.getTime() <= now.getTime()) {
        toast.error("No podés mover una clase a una fecha y hora que ya pasaron.");
        return;
      }
    }

    if (!cls.court_id) {
      toast.error("Esta clase no tiene cancha asignada.");
      return;
    }

    setRescheduling(true);
    try {
      const { data: clash, error: clashErr } = await supabase
        .from("class_sessions")
        .select("id")
        .eq("court_id", cls.court_id)
        .eq("date", iso)
        .neq("id", cls.id)
        .neq("status", "cancelled")
        .limit(1);
      if (clashErr) throw clashErr;
      if ((clash ?? []).length > 0) {
        toast.error("Ese horario ya está ocupado en esa cancha. Elegí otra hora.");
        return;
      }

      if (cls.coach_id) {
        const { data: coachClash, error: coachClashErr } = await supabase
          .from("class_sessions")
          .select("id")
          .eq("coach_id", cls.coach_id)
          .eq("date", iso)
          .neq("status", "cancelled")
          .neq("id", cls.id)
          .limit(1);
        if (coachClashErr) {
          toast.error("No se pudo verificar la disponibilidad del profesor. Intenta nuevamente.");
          return;
        }
        if ((coachClash ?? []).length > 0) {
          toast.warning("El profesor ya tiene una clase en ese horario.");
        }
      }

      const { data: upd, error: updErr } = await supabase
        .from("class_sessions")
        .update({ date: iso })
        .eq("id", cls.id)
        .select("id,date")
        .maybeSingle();
      if (updErr) throw updErr;
      if (!upd) throw new Error("No se pudo reprogramar la clase.");

      toast.success("Clase reprogramada.");
      setDetailsOpen(false);
      setRescheduleOpen(false);

      const vr = visibleRangeRef.current;
      if (vr) await loadCalendarRange(vr.start, vr.end);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo reprogramar.");
    } finally {
      setRescheduling(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 pb-28 pt-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[#0f172a]">Calendario</h1>
          <p className="text-sm text-slate-600 mt-1">Vista mensual/semanal/diaria. Duración fija: 60 minutos.</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="min-w-[240px]">
            <Select
              value={selectedAcademyId ?? ""}
              onValueChange={(val) => {
                const next = val && val.trim() ? val : null;
                setSelectedAcademyId(next);
                if (typeof window !== "undefined") {
                  if (next) window.localStorage.setItem("selectedAcademyId", next);
                  else window.localStorage.removeItem("selectedAcademyId");
                  window.dispatchEvent(new CustomEvent("selectedAcademyIdChanged", { detail: { academyId: next } }));
                }

                const vr = visibleRangeRef.current;
                if (vr) void loadCalendarRange(vr.start, vr.end);
              }}
              disabled={academies.length <= 1}
            >
              <SelectTrigger className="h-11 bg-white">
                <SelectValue placeholder="Selecciona academia" />
              </SelectTrigger>
              <SelectContent>
                {academies.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={loading || !visibleRangeRef.current}
            onClick={() => {
              const vr = visibleRangeRef.current;
              if (!vr) return;
              void loadCalendarRange(vr.start, vr.end);
            }}
          >
            {loading ? "Cargando..." : "Actualizar"}
          </Button>
        </div>
      </div>

      <div className="mt-4 rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="p-3 border-b bg-slate-50 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-800">Agenda</div>
          <div className="text-xs text-slate-500">
            {role ? `Rol: ${role}` : ""}
          </div>
        </div>

        <div className="p-3">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            height="auto"
            locale="es"
            firstDay={1}
            nowIndicator
            weekends
            selectable
            selectMirror
            eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            events={events}
            datesSet={(arg) => {
              visibleRangeRef.current = { start: arg.start, end: arg.end };
              void loadCalendarRange(arg.start, arg.end);
            }}
            eventClick={(info) => {
              onOpenDetails(info.event);
            }}
          />
        </div>
      </div>

      <div className="mt-3 text-xs text-slate-500">
        Este módulo está listo para sumar eventos manuales, bloqueos y feriados. (V1: se muestran clases + conteo de reservas)
      </div>

      <Dialog
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) {
            setRescheduleOpen(false);
            setDetailsEvent(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-[#0f172a]">Detalle</DialogTitle>
            <DialogDescription>
              {detailsEvent?.props?.kind === "class_session" ? "Clase" : "Evento"}
            </DialogDescription>
          </DialogHeader>

          {detailsEvent?.props?.kind === "class_session" ? (
            <div className="space-y-3">
              <div className="rounded-lg border bg-slate-50 p-3">
                <div className="text-sm font-semibold text-slate-800">{detailsEvent?.title || "Clase"}</div>
                <div className="mt-1 text-xs text-slate-600">
                  {detailsEvent?.start ? new Date(detailsEvent.start).toLocaleString("es-PY") : ""}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700">
                  <div>
                    <div className="text-[11px] text-slate-500">Cancha</div>
                    <div className="font-medium">{detailsEvent?.props?.courtName ?? "-"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Profesor</div>
                    <div className="font-medium">{detailsEvent?.props?.coachName ?? "-"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Reservas</div>
                    <div className="font-medium">{String(detailsEvent?.props?.bookingsCount ?? 0)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Duración</div>
                    <div className="font-medium">60 min</div>
                  </div>
                </div>
              </div>

              {rescheduleOpen && (
                <div className="rounded-lg border p-3">
                  <div className="text-sm font-semibold text-slate-800">Reprogramar</div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">Fecha</label>
                      <input
                        type="date"
                        value={rescheduleDay}
                        onChange={(e) => setRescheduleDay(e.target.value)}
                        className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3cadaf]/40"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">Hora</label>
                      <Select value={rescheduleTime} onValueChange={setRescheduleTime}>
                        <SelectTrigger className="h-10 bg-white">
                          <SelectValue placeholder="Selecciona una hora" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60 overflow-y-auto">
                          {Array.from({ length: 18 }).map((_, idx) => {
                            const h = 6 + idx;
                            const t = `${pad2(h)}:00`;
                            return (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <div className="mt-1 text-[11px] text-slate-500">Rango permitido: 06:00 a 23:00</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-slate-600">Sin detalles.</div>
          )}

          <DialogFooter>
            <div className="flex w-full items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDetailsOpen(false);
                }}
              >
                Cerrar
              </Button>

              {detailsEvent?.props?.kind === "class_session" && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setRescheduleOpen((p) => !p)}
                    disabled={rescheduling}
                  >
                    {rescheduleOpen ? "Ocultar" : "Reprogramar"}
                  </Button>
                  {rescheduleOpen && (
                    <Button type="button" onClick={onConfirmReschedule} disabled={rescheduling}>
                      {rescheduling ? "Guardando..." : "Guardar"}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
