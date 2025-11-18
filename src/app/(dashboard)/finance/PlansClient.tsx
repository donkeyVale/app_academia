"use client";

import { useEffect, useState } from 'react';
import { createClientBrowser } from '@/lib/supabase';

const iconColor = "#3cadaf";

const IconMoney = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className="w-5 h-5"
    {...props}
  >
    <rect x="3" y="6" width="18" height="12" rx="2" ry="2" stroke={iconColor} fill="none" strokeWidth="1.6" />
    <circle cx="12" cy="12" r="3" stroke={iconColor} fill="none" strokeWidth="1.6" />
    <path d="M6 9h2" stroke={iconColor} strokeWidth="1.6" />
    <path d="M16 15h2" stroke={iconColor} strokeWidth="1.6" />
  </svg>
);

type Plan = {
  id: string;
  name: string;
  classes_included: number;
  price_cents: number;
  currency: string;
};

type Student = {
  id: string;
  user_id: string | null;
  level: string | null;
  notes: string | null;
  full_name?: string | null;
};

type StudentPlanRow = {
  id: string;
  student_id: string;
  plan_id: string;
  remaining_classes: number;
  purchased_at: string;
  plans: { name: string; classes_included: number } | null;
  students: { level: string | null; notes: string | null } | null;
};

export default function PlansClient() {
  const supabase = createClientBrowser();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentPlans, setStudentPlans] = useState<StudentPlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [remainingClassesInput, setRemainingClassesInput] = useState('');

  // Crear plan
  const [planName, setPlanName] = useState('');
  const [planClasses, setPlanClasses] = useState('');
  const [planPrice, setPlanPrice] = useState('');

  // Resumen por alumno
  const [reportStudentId, setReportStudentId] = useState('');
  const [reportFrom, setReportFrom] = useState(''); // yyyy-mm-dd
  const [reportTo, setReportTo] = useState('');   // yyyy-mm-dd
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSummary, setReportSummary] = useState<{
    planName: string | null;
    totalClasses: number;
    usedClasses: number;
    remainingClasses: number;
  } | null>(null);
  const [reportHistory, setReportHistory] = useState<{
    classId: string;
    date: string;
    present: boolean;
    consumedPlan: boolean;
  }[]>([]);

  // UI: secciones plegables para reducir scroll
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [showAssignPlan, setShowAssignPlan] = useState(true);
  const [showStudentSummary, setShowStudentSummary] = useState(false);

  // Edición de plan existente
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editPlanName, setEditPlanName] = useState('');
  const [editPlanClasses, setEditPlanClasses] = useState('');
  const [editPlanPrice, setEditPlanPrice] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      const { data: plansData, error: pErr } = await supabase
        .from('plans')
        .select('id,name,classes_included,price_cents,currency')
        .order('classes_included');
      if (pErr) setError(pErr.message);
      setPlans((plansData as Plan[]) ?? []);

      const { data: studentsData, error: sErr } = await supabase
        .from('students')
        .select('id,user_id,level,notes')
        .order('created_at', { ascending: false });
      if (sErr) setError(sErr.message);

      let enrichedStudents: Student[] = (studentsData as Student[]) ?? [];
      if (enrichedStudents.length > 0) {
        const userIds = Array.from(
          new Set(
            enrichedStudents
              .map((s) => s.user_id)
              .filter((id): id is string => !!id)
          )
        );

        if (userIds.length > 0) {
          const { data: profilesData, error: profErr } = await supabase
            .from('profiles')
            .select('id,full_name')
            .in('id', userIds);

          if (!profErr && profilesData) {
            const profilesMap = (profilesData as { id: string; full_name: string | null }[]).reduce<Record<string, string | null>>(
              (acc, p) => {
                acc[p.id] = p.full_name;
                return acc;
              },
              {}
            );

            enrichedStudents = enrichedStudents.map((s) => ({
              ...s,
              full_name: s.user_id ? profilesMap[s.user_id] ?? null : null,
            }));
          }
        }
      }

      setStudents(enrichedStudents);

      const { data: spData, error: spErr } = await supabase
        .from('student_plans')
        .select('id,student_id,plan_id,remaining_classes,purchased_at,plans(name,classes_included),students(level,notes)')
        .order('purchased_at', { ascending: false });
      if (spErr) setError(spErr.message);
      setStudentPlans(((spData ?? []) as unknown as StudentPlanRow[]));

      setLoading(false);
    })();
  }, [supabase]);

  const onCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (!planName.trim()) {
        setError('Ingresa un nombre para el plan');
        setSaving(false);
        return;
      }
      const classes = Number(planClasses);
      const price = Number(planPrice);
      if (!classes || classes <= 0) {
        setError('Las clases incluidas deben ser mayores a 0');
        setSaving(false);
        return;
      }
      if (!price || price <= 0) {
        setError('El precio debe ser mayor a 0');
        setSaving(false);
        return;
      }
      const { error: insErr } = await supabase.from('plans').insert({
        name: planName.trim(),
        classes_included: classes,
        price_cents: price,
        currency: 'PYG',
      });
      if (insErr) throw insErr;

      const { data: plansData, error: pErr } = await supabase
        .from('plans')
        .select('id,name,classes_included,price_cents,currency')
        .order('classes_included');
      if (pErr) throw pErr;
      setPlans((plansData as Plan[]) ?? []);

      setPlanName('');
      setPlanClasses('');
      setPlanPrice('');
    } catch (err: any) {
      setError(err.message || 'Error creando plan');
    } finally {
      setSaving(false);
    }
  };

  const onDeletePlan = async (plan: Plan) => {
    if (!confirm('¿Eliminar este plan? Solo se puede eliminar si ningún alumno tiene clases pendientes en este plan.')) return;
    setSaving(true);
    setError(null);
    try {
      // Verificar que no existan student_plans activos con clases restantes
      const { count, error: spErr } = await supabase
        .from('student_plans')
        .select('id', { count: 'exact', head: true })
        .eq('plan_id', plan.id)
        .gt('remaining_classes', 0);
      if (spErr) throw spErr;
      const hasActive = (count ?? 0) > 0;
      if (hasActive) {
        setError('No se puede eliminar este plan porque hay alumnos con clases pendientes de este plan.');
        setSaving(false);
        return;
      }

      const { error: delErr } = await supabase.from('plans').delete().eq('id', plan.id);
      if (delErr) throw delErr;

      const { data: plansData, error: pErr } = await supabase
        .from('plans')
        .select('id,name,classes_included,price_cents,currency')
        .order('classes_included');
      if (pErr) throw pErr;
      setPlans((plansData as Plan[]) ?? []);
    } catch (err: any) {
      setError(err.message || 'Error eliminando plan');
    } finally {
      setSaving(false);
    }
  };

  const startEditPlan = (plan: Plan) => {
    setEditingPlanId(plan.id);
    setEditPlanName(plan.name);
    setEditPlanClasses(String(plan.classes_included));
    setEditPlanPrice(String(plan.price_cents));
  };

  const onUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlanId) return;
    setSaving(true);
    setError(null);
    try {
      const name = editPlanName.trim();
      const classes = Number(editPlanClasses);
      const price = Number(editPlanPrice);
      if (!name) {
        setError('Ingresa un nombre para el plan');
        setSaving(false);
        return;
      }
      if (!classes || classes <= 0) {
        setError('Las clases incluidas deben ser mayores a 0');
        setSaving(false);
        return;
      }
      if (!price || price <= 0) {
        setError('El precio debe ser mayor a 0');
        setSaving(false);
        return;
      }

      const { error: updErr } = await supabase
        .from('plans')
        .update({ name, classes_included: classes, price_cents: price })
        .eq('id', editingPlanId);
      if (updErr) throw updErr;

      const { data: plansData, error: pErr } = await supabase
        .from('plans')
        .select('id,name,classes_included,price_cents,currency')
        .order('classes_included');
      if (pErr) throw pErr;
      setPlans((plansData as Plan[]) ?? []);

      setEditingPlanId(null);
      setEditPlanName('');
      setEditPlanClasses('');
      setEditPlanPrice('');
    } catch (err: any) {
      setError(err.message || 'Error actualizando plan');
    } finally {
      setSaving(false);
    }
  };

  const onLoadReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportStudentId) {
      setError('Selecciona un alumno para ver el resumen');
      return;
    }
    setReportLoading(true);
    setError(null);
    try {
      // Obtener último plan asignado al alumno
      const { data: spData, error: spErr } = await supabase
        .from('student_plans')
        .select('id, remaining_classes, purchased_at, plans(name,classes_included)')
        .eq('student_id', reportStudentId)
        .order('purchased_at', { ascending: false })
        .limit(1);
      if (spErr) throw spErr;

      if (!spData || spData.length === 0) {
        setReportSummary(null);
        setReportHistory([]);
        setError('Este alumno aún no tiene planes asignados.');
        setReportLoading(false);
        return;
      }

      const planRow = spData[0] as any;

      // Usos de plan
      const { data: usagesData, error: usagesErr } = await supabase
        .from('plan_usages')
        .select('id,class_id')
        .eq('student_plan_id', planRow.id)
        .eq('student_id', reportStudentId);
      if (usagesErr) throw usagesErr;

      const usedClasses = (usagesData ?? []).length;
      const totalClasses = planRow.remaining_classes as number;
      const remainingClasses = Math.max(0, totalClasses - usedClasses);

      setReportSummary({
        planName: planRow.plans?.name ?? null,
        totalClasses,
        usedClasses,
        remainingClasses,
      });

      const usedClassIds = new Set((usagesData ?? []).map((u: any) => u.class_id as string));

      // Historial de asistencia (todas las clases donde hubo registro de attendance)
      const { data: attData, error: attErr } = await supabase
        .from('attendance')
        .select('class_id,present,class_sessions!inner(id,date)')
        .eq('student_id', reportStudentId);
      if (attErr) throw attErr;

      let rows = (attData ?? []).map((row: any) => ({
        classId: row.class_id as string,
        date: row.class_sessions?.date as string,
        present: !!row.present,
        consumedPlan: usedClassIds.has(row.class_id as string),
      }));

      // Filtrar por rango de fechas si se proporcionan
      if (reportFrom) {
        const fromTs = new Date(reportFrom + 'T00:00:00').getTime();
        rows = rows.filter((r) => new Date(r.date).getTime() >= fromTs);
      }
      if (reportTo) {
        const toTs = new Date(reportTo + 'T23:59:59').getTime();
        rows = rows.filter((r) => new Date(r.date).getTime() <= toTs);
      }

      rows.sort((a, b) => b.date.localeCompare(a.date));
      setReportHistory(rows);
    } catch (err: any) {
      setError(err.message || 'Error cargando resumen');
      setReportSummary(null);
      setReportHistory([]);
    } finally {
      setReportLoading(false);
    }
  };

  const onAssignPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (!selectedStudentId || !selectedPlanId) {
        setError('Selecciona alumno y plan');
        setSaving(false);
        return;
      }
      const plan = plans.find((p) => p.id === selectedPlanId);
      const remaining = Number(remainingClassesInput || (plan?.classes_included ?? 0));
      if (!remaining || remaining <= 0) {
        setError('Las clases restantes deben ser mayores a 0');
        setSaving(false);
        return;
      }
      const { error: insErr } = await supabase.from('student_plans').insert({
        student_id: selectedStudentId,
        plan_id: selectedPlanId,
        remaining_classes: remaining,
      });
      if (insErr) throw insErr;

      const { data: spData, error: spErr } = await supabase
        .from('student_plans')
        .select('id,student_id,plan_id,remaining_classes,purchased_at,plans(name,classes_included),students(level,notes)')
        .order('purchased_at', { ascending: false });
      if (spErr) throw spErr;
      setStudentPlans(((spData ?? []) as unknown as StudentPlanRow[]));

      setSelectedStudentId('');
      setSelectedPlanId('');
      setRemainingClassesInput('');
    } catch (err: any) {
      setError(err.message || 'Error asignando plan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-6 space-y-6 max-w-5xl mx-auto px-4">
      <div className="flex items-center gap-2">
        <IconMoney />
        <h1 className="text-2xl font-semibold text-[#31435d]">Finanzas / Planes</h1>
      </div>

      <div className="border rounded-lg bg-white shadow-sm border-t-4 border-[#3cadaf]">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-2 text-left text-sm font-medium bg-gray-50 hover:bg-gray-100 rounded-t-lg"
          onClick={() => setShowCreatePlan((v) => !v)}
        >
          <span>Crear plan</span>
          <span className="text-xs text-gray-500">{showCreatePlan ? '▼' : '▲'}</span>
        </button>
        {showCreatePlan && (
          <div className="p-4 space-y-4 max-w-xl">
            <form onSubmit={onCreatePlan} className="grid gap-3">
              <div>
                <label className="block text-sm mb-1">Nombre del plan</label>
                <input
                  type="text"
                  className="border rounded p-2 w-full"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">Clases incluidas</label>
                  <input
                    type="number"
                    min={1}
                    className="border rounded p-2 w-full"
                    value={planClasses}
                    onChange={(e) => setPlanClasses(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Precio (PYG)</label>
                  <input
                    type="number"
                    min={1}
                    className="border rounded p-2 w-full"
                    value={planPrice}
                    onChange={(e) => setPlanPrice(e.target.value)}
                  />
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                className="bg-[#3cadaf] hover:bg-[#31435d] text-white rounded px-4 py-2 disabled:opacity-50"
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Crear plan'}
              </button>
            </form>

            {plans.length > 0 && (
              <div className="pt-3 border-t mt-2">
                <h3 className="text-sm font-semibold mb-2">Planes existentes</h3>
                <ul className="space-y-2 text-sm">
                  {plans.map((p) => {
                    const activeStudents = studentPlans.filter((sp) => sp.plan_id === p.id && sp.remaining_classes > 0).length;
                    return (
                    <li key={p.id} className="border rounded-lg p-3 bg-white">
                      {editingPlanId === p.id ? (
                        <form onSubmit={onUpdatePlan} className="grid gap-2">
                          <div>
                            <label className="block text-xs mb-1">Nombre</label>
                            <input
                              type="text"
                              className="border rounded p-2 w-full"
                              value={editPlanName}
                              onChange={(e) => setEditPlanName(e.target.value)}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs mb-1">Clases</label>
                              <input
                                type="number"
                                min={1}
                                className="border rounded p-2 w-full"
                                value={editPlanClasses}
                                onChange={(e) => setEditPlanClasses(e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-xs mb-1">Precio (PYG)</label>
                              <input
                                type="number"
                                min={1}
                                className="border rounded p-2 w-full"
                                value={editPlanPrice}
                                onChange={(e) => setEditPlanPrice(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button
                              type="button"
                              className="text-xs underline"
                              onClick={() => setEditingPlanId(null)}
                            >
                              Cancelar
                            </button>
                            <button
                              type="submit"
                              className="bg-[#3cadaf] hover:bg-[#31435d] text-white rounded px-3 py-1 text-xs disabled:opacity-50"
                              disabled={saving}
                            >
                              {saving ? 'Guardando...' : 'Guardar cambios'}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="font-medium text-[#31435d]">{p.name}</div>
                            <div className="text-xs text-gray-600">
                              {p.classes_included} clases • {p.price_cents} {p.currency}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {activeStudents > 0
                                ? `En uso por ${activeStudents} alumno${activeStudents > 1 ? 's' : ''}`
                                : 'Sin alumnos activos'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="text-xs px-3 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50"
                              onClick={() => onDeletePlan(p)}
                            >
                              Eliminar
                            </button>
                            <button
                              type="button"
                              className="text-xs px-3 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                              onClick={() => startEditPlan(p)}
                            >
                              Editar
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>

    <div className="border rounded-lg bg-white shadow-sm">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-2 text-left text-sm font-medium bg-gray-50 hover:bg-gray-100 rounded-t-lg"
        onClick={() => setShowAssignPlan((v) => !v)}
      >
        <span>Asignar plan y ver recientes</span>
        <span className="text-xs text-gray-500">{showAssignPlan ? '▼' : '▲'}</span>
      </button>
      {showAssignPlan && (
        <div className="space-y-4 p-4">
          <h2 className="text-lg font-semibold mb-2">Asignar plan a alumno</h2>
          <form onSubmit={onAssignPlan} className="grid gap-3 max-w-xl">
            <div>
              <label className="block text-sm mb-1">Alumno</label>
              <select
                className="border rounded p-2 w-full"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
              >
                <option value="">Selecciona un alumno</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name ?? s.notes ?? s.level ?? s.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Plan</label>
              <select
                className="border rounded p-2 w-full"
                value={selectedPlanId}
                onChange={(e) => {
                  const planId = e.target.value;
                  setSelectedPlanId(planId);
                  const plan = plans.find((p) => p.id === planId);
                  if (plan) setRemainingClassesInput(String(plan.classes_included));
                }}
              >
                <option value="">Selecciona un plan</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.classes_included} clases)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Clases restantes iniciales</label>
              <input
                type="number"
                min={1}
                className="border rounded p-2 w-full"
                value={remainingClassesInput}
                onChange={(e) => setRemainingClassesInput(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              className="bg-[#3cadaf] hover:bg-[#31435d] text-white rounded px-4 py-2 disabled:opacity-50"
              disabled={saving}
            >
              {saving ? 'Asignando...' : 'Asignar plan'}
            </button>
          </form>

          <div>
            <h2 className="text-lg font-semibold mb-2">Planes asignados recientes</h2>
            {loading ? (
              <p className="text-sm text-gray-600">Cargando...</p>
            ) : studentPlans.filter((sp) => sp.remaining_classes > 0).length === 0 ? (
              <p className="text-sm text-gray-600">Aún no hay planes asignados con clases pendientes.</p>
            ) : (
              <ul className="text-sm space-y-2">
                {studentPlans
                  .filter((sp) => sp.remaining_classes > 0)
                  .slice(0, 5)
                  .map((sp) => {
                    const studentInfo = students.find((s) => s.id === sp.student_id);
                    const displayName = studentInfo?.full_name ?? studentInfo?.notes ?? studentInfo?.level ?? sp.student_id;
                    return (
                      <li key={sp.id} className="py-2 px-3 border rounded-lg bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-1">
                        <div>
                          <div className="font-medium text-[#31435d]">{displayName}</div>
                          <div className="text-xs text-gray-600">
                            <span className="font-semibold">Plan:</span> {sp.plans?.name ?? sp.plan_id}
                            {' • '}
                            <span className="font-semibold">Incluye:</span> {sp.plans?.classes_included ?? '?'} clases
                            {' • '}
                            <span className="font-semibold">Restantes:</span> {sp.remaining_classes}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          <span className="font-semibold">Asignado:</span> {new Date(sp.purchased_at).toLocaleString()}
                        </div>
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>

    <div className="border rounded-lg bg-white shadow-sm">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-2 text-left text-sm font-medium bg-gray-50 hover:bg-gray-100 rounded-t-lg"
        onClick={() => setShowStudentSummary((v) => !v)}
      >
        <span>Resumen por alumno</span>
        <span className="text-xs text-gray-500">{showStudentSummary ? '▼' : '▲'}</span>
      </button>
      {showStudentSummary && (
        <div className="p-4 space-y-4">
          <h2 className="text-lg font-semibold mb-2">Resumen por alumno</h2>
          <form onSubmit={onLoadReport} className="grid gap-3 max-w-xl mb-4">
            <div>
              <label className="block text-sm mb-1">Alumno</label>
              <select
                className="border rounded p-2 w-full"
                value={reportStudentId}
                onChange={(e) => setReportStudentId(e.target.value)}
              >
                <option value="">Selecciona un alumno</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name ?? s.notes ?? s.level ?? s.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">Desde</label>
                <input
                  type="date"
                  className="border rounded p-2 w-full"
                  value={reportFrom}
                  onChange={(e) => setReportFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Hasta</label>
                <input
                  type="date"
                  className="border rounded p-2 w-full"
                  value={reportTo}
                  onChange={(e) => setReportTo(e.target.value)}
                />
              </div>
            </div>
            <button
              className="bg-[#3cadaf] hover:bg-[#31435d] text-white rounded px-4 py-2 disabled:opacity-50"
              disabled={reportLoading}
            >
              {reportLoading ? 'Cargando...' : 'Ver resumen'}
            </button>
          </form>

          {reportSummary && (
            <div className="mb-4 text-sm">
              <p><strong>Plan:</strong> {reportSummary.planName ?? 'Sin nombre'}</p>
              <p><strong>Clases del plan:</strong> {reportSummary.totalClasses}</p>
              <p><strong>Usadas:</strong> {reportSummary.usedClasses}</p>
              <p><strong>Disponibles:</strong> {reportSummary.remainingClasses}</p>
            </div>
          )}

          {reportHistory.length > 0 && (
            <ul className="text-sm divide-y">
              {reportHistory.map((row) => (
                <li key={row.classId} className="py-2 flex flex-col md:flex-row md:items-center md:justify-between gap-1">
                  <div>
                    <span className="font-medium">{new Date(row.date).toLocaleString()}</span>
                    {' • '}Estado: {row.present ? 'Presente' : 'Ausente'}
                    {' • '}Consumió plan: {row.consumedPlan ? 'Sí' : 'No'}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
    </section>
  );
}
