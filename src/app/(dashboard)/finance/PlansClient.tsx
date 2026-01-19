"use client";

import { useEffect, useRef, useState } from 'react';
import { createClientBrowser } from '@/lib/supabase';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, WalletCards, Receipt, Users, ClipboardList } from 'lucide-react';
import { formatPyg } from '@/lib/formatters';

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

type DatePickerFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

function parseYmd(value: string): Date | undefined {
  if (!value) return undefined;
  const parts = value.split('-');
  if (parts.length !== 3) return undefined;
  const [y, m, d] = parts.map((p) => Number(p));
  if (!y || !m || !d) return undefined;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

function formatYmd(date: Date | undefined): string {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplay(date: Date | undefined): string {
  if (!date) return 'Seleccionar fecha';
  return date.toLocaleDateString('es-PY');
}

function DatePickerField({ value, onChange }: DatePickerFieldProps) {
  const selectedDate = parseYmd(value);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start text-left text-sm font-normal flex items-center gap-2 h-10"
        >
          <CalendarIcon className="h-4 w-4 text-gray-500" />
          <span className={selectedDate ? '' : 'text-gray-400'}>
            {formatDisplay(selectedDate)}
          </span>
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

type Plan = {
  id: string;
  name: string;
  classes_included: number;
  price_cents: number;
  currency: string;
  academy_id?: string | null;
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
  base_price?: number | null;
  discount_type?: string | null;
  discount_value?: number | null;
  final_price?: number | null;
  plans: { name: string; classes_included: number } | null;
  students: { level: string | null; notes: string | null } | null;
  academy_id?: string | null;
};

type PaymentRow = {
  id: string;
  student_id: string;
  student_plan_id: string;
  amount: number;
  currency: string;
  payment_date: string;
  method: string;
  status: string;
  notes: string | null;
};

export default function PlansClient() {
  const supabase = createClientBrowser();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentPlans, setStudentPlans] = useState<StudentPlanRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [paymentsByPlan, setPaymentsByPlan] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [remainingClassesInput, setRemainingClassesInput] = useState('');
  const [discountType, setDiscountType] = useState<'none' | 'percent' | 'amount'>('none');
  const [discountValue, setDiscountValue] = useState('');

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
  const [showAssignPlan, setShowAssignPlan] = useState(false);
  const [showStudentSummary, setShowStudentSummary] = useState(false);
  const [showPaymentsSection, setShowPaymentsSection] = useState(false);
  const [recentPlansSearch, setRecentPlansSearch] = useState('');
  const [reportStudentQuery, setReportStudentQuery] = useState('');
  const [reportStudentOpen, setReportStudentOpen] = useState(false);
  const [assignStudentQuery, setAssignStudentQuery] = useState('');
  const [assignStudentOpen, setAssignStudentOpen] = useState(false);
  const [assignPlanQuery, setAssignPlanQuery] = useState('');
  const [assignPlanOpen, setAssignPlanOpen] = useState(false);

  const assignStudentSearchRef = useRef<HTMLInputElement | null>(null);
  const assignPlanSearchRef = useRef<HTMLInputElement | null>(null);
  const reportStudentSearchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!assignStudentOpen) return;
    const t = window.setTimeout(() => assignStudentSearchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [assignStudentOpen]);

  useEffect(() => {
    if (!assignPlanOpen) return;
    const t = window.setTimeout(() => assignPlanSearchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [assignPlanOpen]);

  useEffect(() => {
    if (!reportStudentOpen) return;
    const t = window.setTimeout(() => reportStudentSearchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [reportStudentOpen]);

  // Edición de plan existente
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editPlanName, setEditPlanName] = useState('');
  const [editPlanClasses, setEditPlanClasses] = useState('');
  const [editPlanPrice, setEditPlanPrice] = useState('');

  // Registrar pago
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentStudentId, setPaymentStudentId] = useState('');
  const [paymentStudentPlanId, setPaymentStudentPlanId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'pagado' | 'pendiente'>('pendiente');
  const [paymentStudentQuery, setPaymentStudentQuery] = useState('');
  const [paymentStudentOpen, setPaymentStudentOpen] = useState(false);
  const [paymentPlanQuery, setPaymentPlanQuery] = useState('');
  const [paymentPlanOpen, setPaymentPlanOpen] = useState(false);
  const [paymentMethodQuery, setPaymentMethodQuery] = useState('');
  const [paymentMethodOpen, setPaymentMethodOpen] = useState(false);
  const [paymentStatusQuery, setPaymentStatusQuery] = useState('');
  const [paymentStatusOpen, setPaymentStatusOpen] = useState(false);
  const [planUsagesByPlanId, setPlanUsagesByPlanId] = useState<Record<string, number>>({});

  const paymentStudentSearchRef = useRef<HTMLInputElement | null>(null);
  const paymentPlanSearchRef = useRef<HTMLInputElement | null>(null);
  const paymentMethodSearchRef = useRef<HTMLInputElement | null>(null);
  const paymentStatusSearchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!paymentStudentOpen) return;
    const t = window.setTimeout(() => paymentStudentSearchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [paymentStudentOpen]);

  useEffect(() => {
    if (!paymentPlanOpen) return;
    const t = window.setTimeout(() => paymentPlanSearchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [paymentPlanOpen]);

  useEffect(() => {
    if (!paymentMethodOpen) return;
    const t = window.setTimeout(() => paymentMethodSearchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [paymentMethodOpen]);

  useEffect(() => {
    if (!paymentStatusOpen) return;
    const t = window.setTimeout(() => paymentStatusSearchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [paymentStatusOpen]);

  const handleDeleteStudentPlan = async (studentPlanId: string) => {
    if (!studentPlanId) return;

    const ok = window.confirm(
      '¿Eliminar esta asignación de plan?\n\nSolo se permitirá si NO hay clases usadas ni pagos registrados para este plan.',
    );
    if (!ok) return;

    setSaving(true);
    setError(null);
    try {
      const { data: usageRows, error: usageErr } = await supabase
        .from('plan_usages')
        .select('id')
        .eq('student_plan_id', studentPlanId)
        .in('status', ['pending', 'confirmed'])
        .limit(1);
      if (usageErr) throw usageErr;
      const hasUsages = (usageRows ?? []).length > 0;

      const { data: paymentRows, error: paymentErr } = await supabase
        .from('payments')
        .select('id')
        .eq('student_plan_id', studentPlanId)
        .limit(1);
      if (paymentErr) throw paymentErr;
      const hasPayments = (paymentRows ?? []).length > 0;

      if (hasUsages || hasPayments) {
        toast.error('No se puede cambiar/eliminar el plan: ya tiene clases usadas y/o pagos asociados.');
        return;
      }

      const { error: delErr } = await supabase.from('student_plans').delete().eq('id', studentPlanId);
      if (delErr) throw delErr;

      setStudentPlans((prev) => prev.filter((sp) => sp.id !== studentPlanId));
      setPayments((prev) => prev.filter((p) => p.student_plan_id !== studentPlanId));
      setPaymentsByPlan((prev) => {
        const next = { ...prev };
        delete next[studentPlanId];
        return next;
      });
      setPlanUsagesByPlanId((prev) => {
        const next = { ...prev };
        delete next[studentPlanId];
        return next;
      });

      toast.success('Asignación eliminada. Ahora podés asignar el plan correcto.');
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo eliminar la asignación del plan.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    (async () => {
      if (!paymentStudentId) {
        setPlanUsagesByPlanId({});
        return;
      }
      try {
        const planIds = studentPlans.filter((sp) => sp.student_id === paymentStudentId).map((sp) => sp.id);
        if (planIds.length === 0) {
          setPlanUsagesByPlanId({});
          return;
        }

        const { data, error } = await supabase
          .from('plan_usages')
          .select('student_plan_id')
          .eq('student_id', paymentStudentId)
          .in('student_plan_id', planIds)
          .in('status', ['pending', 'confirmed']);

        if (error) {
          console.error('Error cargando plan_usages para registrar pago', error);
          setPlanUsagesByPlanId({});
          return;
        }

        const map: Record<string, number> = {};
        (data ?? []).forEach((row: any) => {
          const id = row.student_plan_id as string | undefined;
          if (!id) return;
          map[id] = (map[id] ?? 0) + 1;
        });
        setPlanUsagesByPlanId(map);
      } catch (e) {
        console.error('Error cargando plan_usages para registrar pago', e);
        setPlanUsagesByPlanId({});
      }
    })();
  }, [paymentStudentId, studentPlans, supabase]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      // Leer academia seleccionada desde localStorage (lado cliente)
      let selectedAcademyId: string | null = null;
      if (typeof window !== 'undefined') {
        const stored = window.localStorage.getItem('selectedAcademyId');
        selectedAcademyId = stored && stored.trim() ? stored : null;
      }

      const { data: plansData, error: pErr } = await supabase
        .from('plans')
        .select('id,name,classes_included,price_cents,currency,academy_id')
        .order('classes_included');
      if (pErr) setError(pErr.message);
      let loadedPlans: Plan[] = (plansData as Plan[]) ?? [];
      if (selectedAcademyId) {
        loadedPlans = loadedPlans.filter((p) => p.academy_id === selectedAcademyId);
      }
      setPlans(loadedPlans);

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
      // Si hay academia seleccionada, filtramos alumnos por user_academies (rol student)
      let finalStudents = enrichedStudents;
      if (selectedAcademyId) {
        const { data: uaRows, error: uaErr } = await supabase
          .from('user_academies')
          .select('user_id, role, academy_id')
          .eq('academy_id', selectedAcademyId);
        if (uaErr) {
          setError(uaErr.message);
        } else {
          const rows = (uaRows as { user_id: string | null; role: string; academy_id: string | null }[] | null) ?? [];
          const studentUserIds = new Set(
            rows
              .filter((r) => r.role === 'student' && r.user_id)
              .map((r) => r.user_id as string)
          );
          finalStudents = enrichedStudents.filter((s) => s.user_id && studentUserIds.has(s.user_id));
        }
      }

      setStudents(finalStudents);

      const { data: spData, error: spErr } = await supabase
        .from('student_plans')
        .select('id,student_id,plan_id,remaining_classes,purchased_at,base_price,discount_type,discount_value,final_price,academy_id,plans(name,classes_included),students(level,notes)')
        .order('purchased_at', { ascending: false });
      if (spErr) setError(spErr.message);

      let finalStudentPlans: StudentPlanRow[] = ((spData ?? []) as unknown as StudentPlanRow[]);
      if (selectedAcademyId) {
        finalStudentPlans = finalStudentPlans.filter((sp) => sp.academy_id === selectedAcademyId);
      }
      setStudentPlans(finalStudentPlans);

      const allowedPlanIds = new Set(finalStudentPlans.map((sp) => sp.id));

      const allowedPlanIdsList = Array.from(allowedPlanIds);

      const payQuery = supabase
        .from('payments')
        .select('id,student_id,student_plan_id,amount,currency,payment_date,method,status,notes')
        .order('payment_date', { ascending: false })
        .limit(10);

      const { data: payData, error: payErr } =
        selectedAcademyId && allowedPlanIdsList.length > 0
          ? await payQuery.in('student_plan_id', allowedPlanIdsList)
          : selectedAcademyId
            ? { data: [], error: null }
            : await payQuery;
      if (payErr) setError(payErr.message);
      setPayments(((payData ?? []) as unknown as PaymentRow[]));

      const payAggQuery = supabase.from('payments').select('student_plan_id,amount,status');

      const { data: payAggData, error: payAggErr } =
        selectedAcademyId && allowedPlanIdsList.length > 0
          ? await payAggQuery.in('student_plan_id', allowedPlanIdsList)
          : selectedAcademyId
            ? { data: [], error: null }
            : await payAggQuery;

      if (!payAggErr && payAggData) {
        const map: Record<string, number> = {};
        (payAggData as { student_plan_id: string; amount: number; status: string }[]).forEach((p) => {
          if (p.status !== 'pagado') return;
          map[p.student_plan_id] = (map[p.student_plan_id] ?? 0) + (p.amount ?? 0);
        });
        setPaymentsByPlan(map);
      }

      setLoading(false);
    })();
  }, [supabase]);

  const onCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (!planName.trim()) {
        const msg = 'Ingresa un nombre para el plan';
        setError(msg);
        toast.error(msg);
        setSaving(false);
        return;
      }
      const classes = Number(planClasses);
      const price = Number(planPrice);
      if (!classes || classes <= 0) {
        const msg = 'Las clases incluidas deben ser mayores a 0';
        setError(msg);
        toast.error(msg);
        setSaving(false);
        return;
      }
      if (!price || price <= 0) {
        const msg = 'El precio debe ser mayor a 0';
        setError(msg);
        toast.error(msg);
        setSaving(false);
        return;
      }
      // Asociar plan a la academia seleccionada
      let selectedAcademyId: string | null = null;
      if (typeof window !== 'undefined') {
        const stored = window.localStorage.getItem('selectedAcademyId');
        selectedAcademyId = stored && stored.trim() ? stored : null;
      }
      if (!selectedAcademyId) {
        const msg = 'Debes seleccionar una academia antes de crear un plan.';
        setError(msg);
        toast.error(msg);
        setSaving(false);
        return;
      }

      const { error: insErr } = await supabase.from('plans').insert({
        name: planName.trim(),
        classes_included: classes,
        price_cents: price,
        currency: 'PYG',
        academy_id: selectedAcademyId,
      });
      if (insErr) throw insErr;

      const { data: plansData, error: pErr } = await supabase
        .from('plans')
        .select('id,name,classes_included,price_cents,currency,academy_id')
        .order('classes_included');
      if (pErr) throw pErr;
      let reloadedPlans: Plan[] = (plansData as Plan[]) ?? [];
      reloadedPlans = reloadedPlans.filter((p) => p.academy_id === selectedAcademyId);
      setPlans(reloadedPlans);

      setPlanName('');
      setPlanClasses('');
      setPlanPrice('');
      toast.success('Plan creado correctamente');
    } catch (err: any) {
      const msg = err.message || 'Error creando plan';
      setError(msg);
      toast.error(msg);
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
        const msg = 'No se puede eliminar este plan porque hay alumnos con clases pendientes de este plan.';
        setError(msg);
        toast.error(msg);
        setSaving(false);
        return;
      }

      const { error: delErr } = await supabase.from('plans').delete().eq('id', plan.id);
      if (delErr) throw delErr;

      let selectedAcademyId: string | null = null;
      if (typeof window !== 'undefined') {
        const stored = window.localStorage.getItem('selectedAcademyId');
        selectedAcademyId = stored && stored.trim() ? stored : null;
      }

      const { data: plansData, error: pErr } = await supabase
        .from('plans')
        .select('id,name,classes_included,price_cents,currency,academy_id')
        .order('classes_included');
      if (pErr) throw pErr;
      let reloadedPlans: Plan[] = (plansData as Plan[]) ?? [];
      if (selectedAcademyId) {
        reloadedPlans = reloadedPlans.filter((p) => p.academy_id === selectedAcademyId);
      }
      setPlans(reloadedPlans);

      toast.success('Plan eliminado correctamente');
    } catch (err: any) {
      const msg = err.message || 'Error eliminando plan';
      setError(msg);
      toast.error(msg);
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
        const msg = 'Ingresa un nombre para el plan';
        setError(msg);
        toast.error(msg);
        setSaving(false);
        return;
      }
      if (!classes || classes <= 0) {
        const msg = 'Las clases incluidas deben ser mayores a 0';
        setError(msg);
        toast.error(msg);
        setSaving(false);
        return;
      }
      if (!price || price <= 0) {
        const msg = 'El precio debe ser mayor a 0';
        setError(msg);
        toast.error(msg);
        setSaving(false);
        return;
      }

      const { error: updErr } = await supabase
        .from('plans')
        .update({ name, classes_included: classes, price_cents: price })
        .eq('id', editingPlanId);
      if (updErr) throw updErr;

      let selectedAcademyId: string | null = null;
      if (typeof window !== 'undefined') {
        const stored = window.localStorage.getItem('selectedAcademyId');
        selectedAcademyId = stored && stored.trim() ? stored : null;
      }

      const { data: plansData, error: pErr } = await supabase
        .from('plans')
        .select('id,name,classes_included,price_cents,currency,academy_id')
        .order('classes_included');
      if (pErr) throw pErr;
      let reloadedPlans: Plan[] = (plansData as Plan[]) ?? [];
      if (selectedAcademyId) {
        reloadedPlans = reloadedPlans.filter((p) => p.academy_id === selectedAcademyId);
      }
      setPlans(reloadedPlans);

      setEditingPlanId(null);
      setEditPlanName('');
      setEditPlanClasses('');
      setEditPlanPrice('');
      toast.success('Plan actualizado correctamente');
    } catch (err: any) {
      const msg = err.message || 'Error actualizando plan';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const onLoadReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportStudentId) {
      const msg = 'Selecciona un alumno para ver el resumen';
      setError(msg);
      toast.error(msg);
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
        const msg = 'Este alumno aún no tiene planes asignados.';
        setError(msg);
        toast.error(msg);
        setReportLoading(false);
        return;
      }

      const planRow = spData[0] as any;

      // Usos de plan
      const { data: usagesData, error: usagesErr } = await supabase
        .from('plan_usages')
        .select('id,class_id')
        .eq('student_plan_id', planRow.id)
        .eq('student_id', reportStudentId)
        .in('status', ['pending', 'confirmed']);
      if (usagesErr) throw usagesErr;

      const remainingClasses = (planRow.remaining_classes ?? 0) as number;
      const usedCountFromUsages = (usagesData ?? []).length;
      const totalClasses = (planRow.plans?.classes_included ?? remainingClasses + usedCountFromUsages) as number;
      const usedClasses = Math.max(0, totalClasses - remainingClasses);

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

      if (planRow.purchased_at) {
        const purchasedTs = new Date(planRow.purchased_at).getTime();
        if (!Number.isNaN(purchasedTs)) {
          rows = rows.filter((r) => new Date(r.date).getTime() >= purchasedTs);
        }
      }

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
      const msg = err.message || 'Error cargando resumen';
      setError(msg);
      toast.error(msg);
      setReportLoading(false);
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
        const msg = 'Selecciona alumno y plan';
        toast.error(msg);
        setSaving(false);
        return;
      }
      const plan = plans.find((p) => p.id === selectedPlanId);
      const remaining = Number(remainingClassesInput || (plan?.classes_included ?? 0));
      if (!remaining || remaining <= 0) {
        const msg = 'Las clases restantes deben ser mayores a 0';
        toast.error(msg);
        setSaving(false);
        return;
      }
      const { data: existingPlans, error: existingErr } = await supabase
        .from('student_plans')
        .select('id, remaining_classes')
        .eq('student_id', selectedStudentId);
      if (existingErr) {
        const msg = 'No se pudo verificar los planes vigentes del alumno. Intenta nuevamente.';
        toast.error(msg);
        setSaving(false);
        return;
      }
      if (existingPlans && existingPlans.length > 0) {
        for (const sp of existingPlans as any[]) {
          const { count: usedCount, error: usageErr } = await supabase
            .from('plan_usages')
            .select('id', { count: 'exact', head: true })
            .eq('student_plan_id', sp.id)
            .eq('student_id', selectedStudentId)
            .in('status', ['pending', 'confirmed']);
          if (usageErr) {
            const msg = 'No se pudo verificar el uso de planes del alumno. Intenta nuevamente.';
            toast.error(msg);
            setSaving(false);
            return;
          }
          const used = usedCount ?? 0;
          if (used < (sp.remaining_classes as number)) {
            const msg = 'Este alumno ya tiene un plan vigente con clases disponibles. Primero debe agotar ese plan antes de asignar uno nuevo.';
            toast.error(msg);
            setSaving(false);
            return;
          }
        }
      }
      const basePrice = plan?.price_cents ?? 0;
      let finalPrice = basePrice;
      const discountNum = Number(discountValue || 0);
      if (discountType === 'percent' && discountNum > 0) {
        finalPrice = Math.max(0, basePrice - (basePrice * discountNum) / 100);
      } else if (discountType === 'amount' && discountNum > 0) {
        finalPrice = Math.max(0, basePrice - discountNum);
      }
      if (!basePrice || basePrice <= 0) {
        const msg = 'El plan seleccionado no tiene un precio válido.';
        toast.error(msg);
        setSaving(false);
        return;
      }
      if (!finalPrice || finalPrice <= 0) {
        const msg = 'El precio final debe ser mayor a 0 (revisa el descuento aplicado).';
        toast.error(msg);
        setSaving(false);
        return;
      }
      // Asociar el plan al alumno dentro de la academia seleccionada
      let selectedAcademyId: string | null = null;
      if (typeof window !== 'undefined') {
        const stored = window.localStorage.getItem('selectedAcademyId');
        selectedAcademyId = stored && stored.trim() ? stored : null;
      }
      if (!selectedAcademyId) {
        const msg = 'Debes seleccionar una academia antes de asignar un plan.';
        toast.error(msg);
        setSaving(false);
        return;
      }

      const { error: insErr } = await supabase.from('student_plans').insert({
        student_id: selectedStudentId,
        plan_id: selectedPlanId,
        remaining_classes: remaining,
        base_price: basePrice,
        discount_type: discountType,
        discount_value: discountNum,
        final_price: finalPrice,
        academy_id: selectedAcademyId,
      });
      if (insErr) throw insErr;

      const { data: spData, error: spErr } = await supabase
        .from('student_plans')
        .select('id,student_id,plan_id,remaining_classes,purchased_at,base_price,discount_type,discount_value,final_price,academy_id,plans(name,classes_included),students(level,notes)')
        .order('purchased_at', { ascending: false });
      if (spErr) throw spErr;

      let refreshedPlans: StudentPlanRow[] = ((spData ?? []) as unknown as StudentPlanRow[]);
      if (selectedAcademyId) {
        refreshedPlans = refreshedPlans.filter((sp) => sp.academy_id === selectedAcademyId);
      }
      setStudentPlans(refreshedPlans);

      setSelectedStudentId('');
      setSelectedPlanId('');
      setRemainingClassesInput('');
      setDiscountType('none');
      setDiscountValue('');
      toast.success('Plan asignado al alumno');
    } catch (err: any) {
      const msg = err.message || 'Error asignando plan';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const onCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (!paymentStudentId || !paymentStudentPlanId) {
        const msg = 'Selecciona alumno y plan para registrar el pago';
        setError(msg);
        toast.error(msg);
        setSaving(false);
        return;
      }
      const amountNum = Number(paymentAmount);
      if (!amountNum || amountNum <= 0) {
        const msg = 'El monto del pago debe ser mayor a 0';
        setError(msg);
        toast.error(msg);
        setSaving(false);
        return;
      }

      // Validar que la suma de pagos no supere el precio final del plan
      const sp = studentPlans.find((sp) => sp.id === paymentStudentPlanId);
      const basePrice = sp?.base_price ?? null;
      const finalPrice = sp?.final_price ?? basePrice;
      if (finalPrice != null) {
        const alreadyPaid = paymentsByPlan[paymentStudentPlanId] ?? 0;
        const newTotalPaid = alreadyPaid + amountNum;
        if (newTotalPaid > finalPrice) {
          const mensaje = `El total pagado (${newTotalPaid} PYG) no puede superar el valor del plan (${finalPrice} PYG). Ajusta el monto del pago.`;
          setError(mensaje);
          toast.error(mensaje);
          setSaving(false);
          return;
        }
      }
      const dateToUse = paymentDate || new Date().toISOString().slice(0, 10);

      const { error: insErr } = await supabase.from('payments').insert({
        student_id: paymentStudentId,
        student_plan_id: paymentStudentPlanId,
        amount: amountNum,
        currency: 'PYG',
        payment_date: dateToUse,
        method: paymentMethod,
        status: paymentStatus,
        notes: paymentNotes.trim() || null,
      });
      if (insErr) throw insErr;

      // Para push, preferimos la academia real del plan (multiacademia). Fallback: selectedAcademyId.
      let academyIdForPush: string | null = (sp?.academy_id as string | null | undefined) ?? null;
      if (!academyIdForPush && typeof window !== 'undefined') {
        const stored = window.localStorage.getItem('selectedAcademyId');
        academyIdForPush = stored && stored.trim() ? stored : null;
      }

      if (paymentStatus === 'pagado' && academyIdForPush) {
        try {
          const adminRes = await fetch('/api/push/payment-registered', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              academyId: academyIdForPush,
              studentId: paymentStudentId,
              studentPlanId: paymentStudentPlanId,
              amount: amountNum,
              currency: 'PYG',
              paymentDate: dateToUse,
            }),
          });

          if (!adminRes.ok) {
            let errJson: any = null;
            try {
              errJson = await adminRes.json();
            } catch {
              errJson = null;
            }
            console.error('Push payment-registered falló', { status: adminRes.status, body: errJson });
          }

          const studentRes = await fetch('/api/push/payment-student', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              academyId: academyIdForPush,
              studentId: paymentStudentId,
              studentPlanId: paymentStudentPlanId,
              amount: amountNum,
              currency: 'PYG',
              paymentDate: dateToUse,
            }),
          });

          if (!studentRes.ok) {
            let errJson: any = null;
            try {
              errJson = await studentRes.json();
            } catch {
              errJson = null;
            }
            console.error('Push payment-student falló', { status: studentRes.status, body: errJson });
          }
        } catch (pushErr) {
          console.error('Error enviando notificación push de pago registrado', pushErr);
        }
      }

      // actualizar totales de pago por plan en memoria para reflejar el saldo sin recargar
      if (paymentStatus === 'pagado') {
        setPaymentsByPlan((prev) => ({
          ...prev,
          [paymentStudentPlanId]: (prev[paymentStudentPlanId] ?? 0) + amountNum,
        }));
      }

      let academyIdForRefresh: string | null = (sp?.academy_id as string | null | undefined) ?? null;
      if (!academyIdForRefresh && typeof window !== 'undefined') {
        const stored = window.localStorage.getItem('selectedAcademyId');
        academyIdForRefresh = stored && stored.trim() ? stored : null;
      }

      const allowedPlanIdsList = academyIdForRefresh
        ? studentPlans
            .filter((row) => row.academy_id === academyIdForRefresh)
            .map((row) => row.id)
        : [];

      const payQuery = supabase
        .from('payments')
        .select('id,student_id,student_plan_id,amount,currency,payment_date,method,status,notes')
        .order('payment_date', { ascending: false })
        .limit(10);

      const { data: payData, error: payErr } =
        academyIdForRefresh && allowedPlanIdsList.length > 0
          ? await payQuery.in('student_plan_id', allowedPlanIdsList)
          : academyIdForRefresh
            ? { data: [], error: null }
            : await payQuery;

      if (payErr) throw payErr;
      setPayments(((payData ?? []) as unknown as PaymentRow[]));

      setPaymentStudentId('');
      setPaymentStudentPlanId('');
      setPaymentAmount('');
      setPaymentDate('');
      setPaymentMethod('efectivo');
      setPaymentNotes('');
      setPaymentStatus('pendiente');
      setPaymentModalOpen(false);
      toast.success('Pago registrado correctamente');
    } catch (err: any) {
      const msg = err.message || 'Error registrando pago';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">

      <div className="border rounded-lg bg-white shadow-sm">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-2 text-left text-sm font-medium bg-gray-50 hover:bg-gray-100 rounded-t-lg"
          onClick={() => setShowCreatePlan((v) => !v)}
        >
          <span className="inline-flex items-center gap-2">
            <WalletCards className="w-4 h-4 text-emerald-500" />
            <span>Planes y precios</span>
          </span>
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
                              {p.classes_included} clases • {formatPyg(p.price_cents)} {p.currency}
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
        <span className="inline-flex items-center gap-2">
          <Users className="w-4 h-4 text-violet-500" />
          <span>Planes asignados y saldos</span>
        </span>
        <span className="text-xs text-gray-500">{showAssignPlan ? '▼' : '▲'}</span>
      </button>
      {showAssignPlan && (
        <div className="space-y-4 p-4">
          <h2 className="text-lg font-semibold mb-2">Asignar plan a alumno</h2>
          <form onSubmit={onAssignPlan} className="grid gap-3 max-w-xl">
            <div>
              <label className="block text-sm mb-1">Alumno</label>
              <Popover open={assignStudentOpen} onOpenChange={setAssignStudentOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between text-sm font-normal"
                  >
                    <span className="truncate mr-2">
                      {(() => {
                        if (!selectedStudentId) return 'Seleccionar alumno';
                        const s = students.find((x) => x.id === selectedStudentId);
                        return (s?.full_name ?? s?.notes ?? s?.level ?? s?.id ?? 'Seleccionar alumno') as string;
                      })()}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-3" align="start">
                  <div className="space-y-2">
                    <Input
                      type="text"
                      placeholder="Buscar alumnos..."
                      value={assignStudentQuery}
                      onChange={(e) => setAssignStudentQuery(e.target.value)}
                      className="h-11 text-base"
                      ref={assignStudentSearchRef}
                    />
                    <div className="max-h-52 overflow-auto border rounded-md divide-y">
                      {(() => {
                        const filtered = students.filter((s) => {
                          const t = (assignStudentQuery || '').toLowerCase();
                          if (!t) return true;
                          const label =
                            (s.full_name || '') +
                            ' ' +
                            (s.notes || '') +
                            ' ' +
                            (s.level || '') +
                            ' ' +
                            s.id;
                          return label.toLowerCase().includes(t);
                        });
                        const limited = filtered.slice(0, 50);

                        if (students.length === 0) {
                          return (
                            <div className="px-2 py-1.5 text-xs text-gray-500">No hay alumnos cargados.</div>
                          );
                        }
                        if (filtered.length === 0) {
                          return (
                            <div className="px-2 py-1.5 text-xs text-gray-500">
                              No se encontraron alumnos con ese criterio de búsqueda.
                            </div>
                          );
                        }
                        return (
                          <>
                            {limited.map((s) => {
                              const displayName = s.full_name ?? s.notes ?? s.level ?? s.id;
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedStudentId(s.id);
                                    setAssignStudentQuery('');
                                    setAssignStudentOpen(false);
                                  }}
                                  className="w-full flex items-center justify-between px-2 py-1.5 text-sm hover:bg-slate-50"
                                >
                                  <span className="mr-2 truncate">{displayName}</span>
                                </button>
                              );
                            })}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="block text-sm mb-1">Plan</label>
              <Popover open={assignPlanOpen} onOpenChange={setAssignPlanOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-between text-sm font-normal">
                    <span className="truncate mr-2">
                      {(() => {
                        if (!selectedPlanId) return 'Seleccionar plan';
                        const p = plans.find((x) => x.id === selectedPlanId);
                        if (!p) return 'Seleccionar plan';
                        return `${p.name} (${p.classes_included} clases)`;
                      })()}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-3" align="start">
                  <div className="space-y-2">
                    <Input
                      type="text"
                      placeholder="Buscar planes..."
                      value={assignPlanQuery}
                      onChange={(e) => setAssignPlanQuery(e.target.value)}
                      className="h-11 text-base"
                      ref={assignPlanSearchRef}
                    />
                    <div className="max-h-52 overflow-auto border rounded-md divide-y">
                      {(() => {
                        const filtered = plans.filter((p) => {
                          const t = (assignPlanQuery || '').toLowerCase();
                          if (!t) return true;
                          const label = `${p.name || ''} ${p.classes_included ?? ''} ${p.id || ''}`;
                          return label.toLowerCase().includes(t);
                        });
                        const limited = filtered.slice(0, 50);

                        if (plans.length === 0) {
                          return (
                            <div className="px-2 py-1.5 text-xs text-gray-500">No hay planes cargados.</div>
                          );
                        }
                        if (filtered.length === 0) {
                          return (
                            <div className="px-2 py-1.5 text-xs text-gray-500">
                              No se encontraron planes con ese criterio de búsqueda.
                            </div>
                          );
                        }
                        return (
                          <>
                            {limited.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setSelectedPlanId(p.id);
                                  setRemainingClassesInput(String(p.classes_included ?? ''));
                                  setAssignPlanQuery('');
                                  setAssignPlanOpen(false);
                                }}
                                className="w-full flex items-center justify-between px-2 py-1.5 text-sm hover:bg-slate-50"
                              >
                                <span className="mr-2 truncate">{p.name} ({p.classes_included} clases)</span>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm mb-1">Precio base del plan</label>
                <div className="border rounded px-3 py-2 text-sm bg-gray-50">
                  {(() => {
                    const plan = plans.find((p) => p.id === selectedPlanId);
                    return plan ? `${plan.price_cents} ${plan.currency}` : '-';
                  })()}
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1">Tipo de descuento</label>
                <select
                  className="border rounded p-2 w-full text-base md:text-sm"
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as 'none' | 'percent' | 'amount')}
                >
                  <option value="none">Sin descuento</option>
                  <option value="percent">Porcentaje (%)</option>
                  <option value="amount">Monto fijo</option>
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">Valor del descuento</label>
                <input
                  type="number"
                  min={0}
                  className="border rounded p-2 w-full text-base md:text-sm"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  disabled={discountType === 'none'}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1">Precio final del plan para este alumno</label>
              <div className="border rounded px-3 py-2 text-sm bg-gray-50">
                {(() => {
                  const plan = plans.find((p) => p.id === selectedPlanId);
                  if (!plan || !plan.price_cents) return '-';
                  const basePrice = plan.price_cents;
                  const discountNum = Number(discountValue || 0);
                  let finalPrice = basePrice;
                  if (discountType === 'percent' && discountNum > 0) {
                    finalPrice = Math.max(0, basePrice - (basePrice * discountNum) / 100);
                  } else if (discountType === 'amount' && discountNum > 0) {
                    finalPrice = Math.max(0, basePrice - discountNum);
                  }
                  return `${finalPrice} ${plan.currency}`;
                })()}
              </div>
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
              <>
                <div className="mb-2">
                  <label className="block text-xs mb-1 text-gray-600">Buscar por alumno o plan</label>
                  <input
                    type="text"
                    className="border rounded px-3 w-full h-10 text-base md:text-sm"
                    placeholder="Ej.: Juan Pérez o Plan Adultos"
                    value={recentPlansSearch}
                    onChange={(e) => setRecentPlansSearch(e.target.value)}
                  />
                </div>
                <ul className="text-sm space-y-2">
                  {studentPlans
                    .filter((sp) => sp.remaining_classes > 0)
                    .filter((sp) => {
                      if (!recentPlansSearch.trim()) return true;
                      const term = recentPlansSearch.toLowerCase();
                      const studentInfo = students.find((s) => s.id === sp.student_id);
                      const displayName = (studentInfo?.full_name ?? studentInfo?.notes ?? studentInfo?.level ?? sp.student_id).toLowerCase();
                      const planName = (sp.plans?.name ?? sp.plan_id ?? '').toLowerCase();
                      return displayName.includes(term) || planName.includes(term);
                    })
                    .slice(0, 5)
                    .map((sp) => {
                      const studentInfo = students.find((s) => s.id === sp.student_id);
                      const displayName = studentInfo?.full_name ?? studentInfo?.notes ?? studentInfo?.level ?? sp.student_id;
                      const basePrice = sp.base_price ?? null;
                      const finalPrice = sp.final_price ?? basePrice;
                      const totalPaid = paymentsByPlan[sp.id] ?? 0;
                      const balance = finalPrice != null ? Math.max(0, finalPrice - totalPaid) : null;
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
                            {finalPrice != null && (
                              <div className="text-xs mt-1">
                                <span className="font-semibold text-gray-600">Total plan:</span> {formatPyg(finalPrice)} PYG
                                {' • '}
                                <span className="font-semibold text-gray-600">Pagado:</span> {formatPyg(totalPaid)} PYG
                                {' • '}
                                <span
                                  className={
                                    balance === 0
                                      ? 'font-semibold text-green-600'
                                      : 'font-semibold text-amber-600'
                                  }
                                >
                                  {balance === 0 ? 'Al día' : `Saldo: ${formatPyg(balance)} PYG`}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <div className="text-xs text-gray-500">
                              <span className="font-semibold">Asignado:</span> {new Date(sp.purchased_at).toLocaleString()}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteStudentPlan(sp.id)}
                              disabled={saving}
                              className="text-xs px-3 py-1 rounded border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50"
                              title="Eliminar asignación (solo si no tiene clases usadas ni pagos)"
                            >
                              Corregir asignación
                            </button>
                          </div>
                        </li>
                      );
                    })}
                </ul>
                {!recentPlansSearch.trim() && (
                  <p className="mt-2 text-xs text-gray-500">Mostrando los 5 planes más recientes con clases pendientes.</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>

    <div className="border rounded-lg bg-white shadow-sm">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-2 text-left text-sm font-medium bg-gray-50 hover:bg-gray-100 rounded-t-lg"
        onClick={() => setShowPaymentsSection((v) => !v)}
      >
        <span className="inline-flex items-center gap-2">
          <Receipt className="w-4 h-4 text-sky-500" />
          <span>Pagos recientes y registros</span>
        </span>
        <span className="text-xs text-gray-500">{showPaymentsSection ? '▼' : '▲'}</span>
      </button>
      {showPaymentsSection && (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Pagos recientes</h2>
            <button
              type="button"
              className="text-xs px-3 py-2 rounded bg-[#3cadaf] hover:bg-[#31435d] text-white"
              onClick={() => {
                setPaymentModalOpen(true);
                setError(null);
              }}
            >
              Registrar pago
            </button>
          </div>
          {payments.length === 0 ? (
            <p className="text-sm text-gray-600">Aún no hay pagos registrados.</p>
          ) : (
            <ul className="text-sm space-y-2">
              {payments.map((p) => {
                const studentInfo = students.find((s) => s.id === p.student_id);
                const displayName = studentInfo?.full_name ?? studentInfo?.notes ?? studentInfo?.level ?? p.student_id;
                const sp = studentPlans.find((sp) => sp.id === p.student_plan_id);
                const planName = sp?.plans?.name ?? sp?.plan_id ?? '';
                return (
                  <li
                    key={p.id}
                    className="py-2 px-3 border rounded-lg bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-1"
                  >
                    <div>
                      <div className="font-medium text-[#31435d]">{displayName}</div>
                      <div className="text-xs text-gray-600">
                        <span className="font-semibold">Plan:</span> {planName || 'Sin nombre'}
                        {' • '}
                        <span className="font-semibold">Monto:</span> {formatPyg(p.amount)} {p.currency}
                        {' • '}
                        <span className="font-semibold">Método:</span> {p.method}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 text-right">
                      <div>{new Date(p.payment_date).toLocaleDateString()}</div>
                      <div className="capitalize">Estado: {p.status}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>

    <div className="border rounded-lg bg-white shadow-sm">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-2 text-left text-sm font-medium bg-gray-50 hover:bg-gray-100 rounded-t-lg"
        onClick={() => setShowStudentSummary((v) => !v)}
      >
        <span className="inline-flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-amber-500" />
          <span>Resumen de uso por alumno</span>
        </span>
        <span className="text-xs text-gray-500">{showStudentSummary ? '▼' : '▲'}</span>
      </button>
      {showStudentSummary && (
        <div className="p-4 space-y-4">
          <h2 className="text-lg font-semibold mb-2">Resumen por alumno</h2>
          <form onSubmit={onLoadReport} className="grid gap-3 max-w-xl mb-4">
            <div>
              <label className="block text-sm mb-1">Alumno</label>
              <Popover open={reportStudentOpen} onOpenChange={setReportStudentOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-between text-sm font-normal">
                    <span className="truncate mr-2">
                      {(() => {
                        if (!reportStudentId) return 'Seleccionar alumno';
                        const s = students.find((x) => x.id === reportStudentId);
                        return (s?.full_name ?? s?.notes ?? s?.level ?? s?.id ?? 'Seleccionar alumno') as string;
                      })()}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-3" align="start">
                  <div className="space-y-2">
                    <Input
                      type="text"
                      placeholder="Buscar alumnos..."
                      value={reportStudentQuery}
                      onChange={(e) => setReportStudentQuery(e.target.value)}
                      className="h-11 text-base"
                      ref={reportStudentSearchRef}
                    />
                    <div className="max-h-52 overflow-auto border rounded-md divide-y">
                      {(() => {
                        const filtered = students.filter((s) => {
                          const t = (reportStudentQuery || '').toLowerCase();
                          if (!t) return true;
                          const label =
                            (s.full_name || '') +
                            ' ' +
                            (s.notes || '') +
                            ' ' +
                            (s.level || '') +
                            ' ' +
                            s.id;
                          return label.toLowerCase().includes(t);
                        });
                        const limited = filtered.slice(0, 50);

                        if (students.length === 0) {
                          return (
                            <div className="px-2 py-1.5 text-xs text-gray-500">No hay alumnos cargados.</div>
                          );
                        }
                        if (filtered.length === 0) {
                          return (
                            <div className="px-2 py-1.5 text-xs text-gray-500">
                              No se encontraron alumnos con ese criterio de búsqueda.
                            </div>
                          );
                        }
                        return (
                          <>
                            {limited.map((s) => {
                              const displayName = s.full_name ?? s.notes ?? s.level ?? s.id;
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => {
                                    setReportStudentId(s.id);
                                    setReportStudentQuery('');
                                    setReportStudentOpen(false);
                                  }}
                                  className="w-full flex items-center justify-between px-2 py-1.5 text-sm hover:bg-slate-50"
                                >
                                  <span className="mr-2 truncate">{displayName}</span>
                                </button>
                              );
                            })}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">Desde</label>
                <DatePickerField value={reportFrom} onChange={setReportFrom} />
              </div>
              <div>
                <label className="block text-sm mb-1">Hasta</label>
                <DatePickerField value={reportTo} onChange={setReportTo} />
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
            <div className="text-xs text-gray-600">
              <p>
                <strong>Nota:</strong> El consumo se registra por reserva (puede consumir aunque figure Ausente por política de no-show).
              </p>
              <p>
                También puede haber Presente sin consumo si la clase fue promocional/sin consumo.
              </p>
            </div>
          )}

          {reportHistory.length > 0 && (
            <ul className="text-sm divide-y">
              {reportHistory.map((row) => (
                <li key={row.classId} className="py-2 flex flex-col md:flex-row md:items-center md:justify-between gap-1">
                  <div>
                    <span className="font-medium">{new Date(row.date).toLocaleString()}</span>
                    {' • '}Asistencia: {row.present ? 'Presente' : 'Ausente'}
                    {' • '}Consumo (por reserva): {row.consumedPlan ? 'Sí' : 'No'}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>

    {paymentModalOpen && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white w-full max-w-md rounded-lg shadow-lg flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b">
            <h2 className="text-lg font-semibold text-[#31435d]">Registrar pago</h2>
          </div>
          <form onSubmit={onCreatePayment} className="px-4 py-3 overflow-y-auto text-sm space-y-3">
            <div>
              <label className="block text-sm mb-1">Alumno</label>
              <Popover open={paymentStudentOpen} onOpenChange={setPaymentStudentOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between text-sm font-normal"
                  >
                    <span className="truncate mr-2">
                      {(() => {
                        if (!paymentStudentId) return 'Seleccionar alumno';
                        const s = students.find((x) => x.id === paymentStudentId);
                        return (s?.full_name ?? s?.notes ?? s?.level ?? s?.id ?? 'Seleccionar alumno') as string;
                      })()}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-3" align="start">
                  <div className="space-y-2">
                    <Input
                      type="text"
                      placeholder="Buscar alumnos..."
                      value={paymentStudentQuery}
                      onChange={(e) => setPaymentStudentQuery(e.target.value)}
                      className="h-11 text-base"
                      ref={paymentStudentSearchRef}
                    />
                    <div className="max-h-52 overflow-auto border rounded-md divide-y">
                      {(() => {
                        const filtered = students.filter((s) => {
                          const t = (paymentStudentQuery || '').toLowerCase();
                          if (!t) return true;
                          const label =
                            (s.full_name || '') +
                            ' ' +
                            (s.notes || '') +
                            ' ' +
                            (s.level || '') +
                            ' ' +
                            s.id;
                          return label.toLowerCase().includes(t);
                        });
                        const limited = filtered.slice(0, 50);

                        if (students.length === 0) {
                          return (
                            <div className="px-2 py-1.5 text-xs text-gray-500">No hay alumnos cargados.</div>
                          );
                        }
                        if (filtered.length === 0) {
                          return (
                            <div className="px-2 py-1.5 text-xs text-gray-500">
                              No se encontraron alumnos con ese criterio de búsqueda.
                            </div>
                          );
                        }
                        return (
                          <>
                            {limited.map((s) => {
                              const displayName = s.full_name ?? s.notes ?? s.level ?? s.id;
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => {
                                    setPaymentStudentId(s.id);
                                    setPaymentStudentPlanId('');
                                    setPaymentStudentQuery('');
                                    setPaymentStudentOpen(false);
                                  }}
                                  className="w-full flex items-center justify-between px-2 py-1.5 text-sm hover:bg-slate-50"
                                >
                                  <span className="mr-2 truncate">{displayName}</span>
                                </button>
                              );
                            })}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="block text-sm mb-1">Plan del alumno</label>
              <Popover
                open={paymentPlanOpen}
                onOpenChange={(open) => {
                  if (!paymentStudentId) return;
                  setPaymentPlanOpen(open);
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between text-sm font-normal"
                    disabled={!paymentStudentId}
                  >
                    <span className="truncate mr-2">
                      {(() => {
                        if (!paymentStudentId) return 'Seleccionar alumno primero';
                        if (!paymentStudentPlanId) return 'Seleccionar plan asignado';
                        const sp = studentPlans.find((x) => x.id === paymentStudentPlanId);
                        if (!sp) return 'Seleccionar plan asignado';
                        const used = planUsagesByPlanId[sp.id] ?? 0;
                        const realRemaining = Math.max(0, (sp.remaining_classes ?? 0) - used);
                        return (sp.plans?.name ?? sp.plan_id) + ` • Restantes: ${realRemaining}`;
                      })()}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-96 p-3" align="start">
                  <div className="space-y-2">
                    <Input
                      type="text"
                      placeholder="Buscar planes del alumno..."
                      value={paymentPlanQuery}
                      onChange={(e) => setPaymentPlanQuery(e.target.value)}
                      className="h-11 text-base"
                      ref={paymentPlanSearchRef}
                    />
                    <div className="max-h-56 overflow-auto border rounded-md divide-y">
                      {(() => {
                        if (!paymentStudentId) {
                          return (
                            <div className="px-2 py-1.5 text-xs text-gray-500">
                              Seleccioná un alumno para ver sus planes.
                            </div>
                          );
                        }

                        const candidates = studentPlans
                          .filter((sp) => sp.student_id === paymentStudentId)
                          .filter((sp) => {
                            const used = planUsagesByPlanId[sp.id] ?? 0;
                            const realRemaining = Math.max(0, (sp.remaining_classes ?? 0) - used);
                            const basePrice = sp.base_price ?? null;
                            const finalPrice = sp.final_price ?? basePrice;
                            const totalPaid = paymentsByPlan[sp.id] ?? 0;
                            const balance = finalPrice != null ? Math.max(0, finalPrice - totalPaid) : 0;
                            return !(realRemaining === 0 && balance === 0);
                          });

                        const filtered = candidates.filter((sp) => {
                          const t = (paymentPlanQuery || '').toLowerCase();
                          if (!t) return true;
                          const planName = (sp.plans?.name ?? sp.plan_id ?? '').toLowerCase();
                          const id = (sp.id ?? '').toLowerCase();
                          return `${planName} ${id}`.includes(t);
                        });

                        const limited = filtered.slice(0, 50);

                        if (candidates.length === 0) {
                          return (
                            <div className="px-2 py-1.5 text-xs text-gray-500">
                              Este alumno no tiene planes disponibles para registrar pagos.
                            </div>
                          );
                        }
                        if (filtered.length === 0) {
                          return (
                            <div className="px-2 py-1.5 text-xs text-gray-500">
                              No se encontraron planes con ese criterio de búsqueda.
                            </div>
                          );
                        }

                        return (
                          <>
                            {limited.map((sp) => {
                              const used = planUsagesByPlanId[sp.id] ?? 0;
                              const realRemaining = Math.max(0, (sp.remaining_classes ?? 0) - used);
                              const basePrice = sp.base_price ?? null;
                              const finalPrice = sp.final_price ?? basePrice;
                              const totalPaid = paymentsByPlan[sp.id] ?? 0;
                              const balance = finalPrice != null ? Math.max(0, finalPrice - totalPaid) : null;
                              const label = (sp.plans?.name ?? sp.plan_id) + ` • Restantes: ${realRemaining}`;
                              return (
                                <button
                                  key={sp.id}
                                  type="button"
                                  onClick={() => {
                                    setPaymentStudentPlanId(sp.id);
                                    setPaymentPlanQuery('');
                                    setPaymentPlanOpen(false);
                                  }}
                                  className="w-full flex flex-col items-start px-2 py-2 text-sm hover:bg-slate-50"
                                >
                                  <span className="w-full truncate">{label}</span>
                                  {balance != null && (
                                    <span className="text-[11px] text-gray-500">
                                      Saldo: {formatPyg(balance)} PYG
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            {paymentStudentPlanId && (
              <div className="text-xs text-gray-600 bg-gray-50 border rounded px-3 py-2">
                {(() => {
                  const sp = studentPlans.find((sp) => sp.id === paymentStudentPlanId);
                  if (!sp) return null;
                  const used = planUsagesByPlanId[sp.id] ?? 0;
                  const realRemaining = Math.max(0, (sp.remaining_classes ?? 0) - used);
                  const basePrice = sp.base_price ?? null;
                  const finalPrice = sp.final_price ?? basePrice;
                  if (finalPrice == null) return 'Este plan no tiene un precio configurado.';
                  const totalPaid = paymentsByPlan[sp.id] ?? 0;
                  const balance = Math.max(0, finalPrice - totalPaid);
                  return (
                    <span>
                      Restantes reales: {realRemaining} •{' '}
                      Total plan: {formatPyg(finalPrice)} PYG • Pagado: {formatPyg(totalPaid)} PYG •{' '}
                      {balance === 0 ? (
                        <span className="text-green-600 font-semibold">Al día</span>
                      ) : (
                        <span className="text-amber-600 font-semibold">Saldo pendiente: {formatPyg(balance)} PYG</span>
                      )}
                    </span>
                  );
                })()}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">Monto (PYG)</label>
                <input
                  type="number"
                  min={1}
                  className="border rounded p-2 w-full text-base md:text-sm"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Fecha de pago</label>
                <DatePickerField value={paymentDate} onChange={setPaymentDate} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">Método</label>
                <Popover open={paymentMethodOpen} onOpenChange={setPaymentMethodOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-between text-sm font-normal">
                      <span className="truncate mr-2">
                        {paymentMethod === 'efectivo'
                          ? 'Efectivo'
                          : paymentMethod === 'transferencia'
                            ? 'Transferencia'
                            : paymentMethod === 'tarjeta'
                              ? 'Tarjeta'
                              : paymentMethod === 'mercadopago'
                                ? 'MercadoPago'
                                : 'Otro'}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-3" align="start">
                    <div className="space-y-2">
                      <Input
                        type="text"
                        placeholder="Buscar..."
                        value={paymentMethodQuery}
                        onChange={(e) => setPaymentMethodQuery(e.target.value)}
                        className="h-11 text-base"
                        ref={paymentMethodSearchRef}
                      />
                      <div className="max-h-52 overflow-auto border rounded-md divide-y">
                        {(() => {
                          const opts: { id: string; name: string }[] = [
                            { id: 'efectivo', name: 'Efectivo' },
                            { id: 'transferencia', name: 'Transferencia' },
                            { id: 'tarjeta', name: 'Tarjeta' },
                            { id: 'mercadopago', name: 'MercadoPago' },
                            { id: 'otro', name: 'Otro' },
                          ];
                          const filtered = opts.filter((o) => {
                            const t = (paymentMethodQuery || '').toLowerCase();
                            if (!t) return true;
                            return o.name.toLowerCase().includes(t) || o.id.toLowerCase().includes(t);
                          });
                          if (filtered.length === 0) {
                            return (
                              <div className="px-2 py-1.5 text-xs text-gray-500">
                                No se encontraron opciones con ese criterio de búsqueda.
                              </div>
                            );
                          }
                          return (
                            <>
                              {filtered.map((o) => (
                                <button
                                  key={o.id}
                                  type="button"
                                  onClick={() => {
                                    setPaymentMethod(o.id);
                                    setPaymentMethodQuery('');
                                    setPaymentMethodOpen(false);
                                  }}
                                  className="w-full flex items-center justify-between px-2 py-1.5 text-sm hover:bg-slate-50"
                                >
                                  <span className="mr-2 truncate">{o.name}</span>
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
              <div>
                <label className="block text-sm mb-1">Estado</label>
                <Popover open={paymentStatusOpen} onOpenChange={setPaymentStatusOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-between text-sm font-normal">
                      <span className="truncate mr-2">{paymentStatus === 'pagado' ? 'Pagado' : 'Pendiente'}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-3" align="start">
                    <div className="space-y-2">
                      <Input
                        type="text"
                        placeholder="Buscar..."
                        value={paymentStatusQuery}
                        onChange={(e) => setPaymentStatusQuery(e.target.value)}
                        className="h-11 text-base"
                        ref={paymentStatusSearchRef}
                      />
                      <div className="max-h-52 overflow-auto border rounded-md divide-y">
                        {(() => {
                          const opts: { id: 'pagado' | 'pendiente'; name: string }[] = [
                            { id: 'pendiente', name: 'Pendiente' },
                            { id: 'pagado', name: 'Pagado' },
                          ];
                          const filtered = opts.filter((o) => {
                            const t = (paymentStatusQuery || '').toLowerCase();
                            if (!t) return true;
                            return o.name.toLowerCase().includes(t) || o.id.toLowerCase().includes(t);
                          });
                          if (filtered.length === 0) {
                            return (
                              <div className="px-2 py-1.5 text-xs text-gray-500">
                                No se encontraron opciones con ese criterio de búsqueda.
                              </div>
                            );
                          }
                          return (
                            <>
                              {filtered.map((o) => (
                                <button
                                  key={o.id}
                                  type="button"
                                  onClick={() => {
                                    setPaymentStatus(o.id);
                                    setPaymentStatusQuery('');
                                    setPaymentStatusOpen(false);
                                  }}
                                  className="w-full flex items-center justify-between px-2 py-1.5 text-sm hover:bg-slate-50"
                                >
                                  <span className="mr-2 truncate">{o.name}</span>
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
            <div>
              <label className="block text-sm mb-1">Notas (opcional)</label>
              <textarea
                className="border rounded p-2 w-full text-base md:text-sm min-h-[60px]"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 py-2 border-t mt-2 pt-3">
              <button
                type="button"
                className="px-3 py-2 border rounded text-xs"
                onClick={() => {
                  setPaymentModalOpen(false);
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3 py-2 bg-[#3cadaf] hover:bg-[#31435d] text-white rounded text-xs disabled:opacity-50"
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Registrar pago'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
    </div>
  );
}