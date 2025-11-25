"use client";

import { useEffect, useState, useRef } from "react";
import { createClientBrowser } from "@/lib/supabase";
import { UserCircle2, Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";

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
          className="w-full justify-start text-left text-sm font-normal flex items-center gap-2 h-10"
        >
          <span className="h-4 w-4 rounded-full border border-gray-300 flex items-center justify-center text-[10px] text-gray-500">
            📅
          </span>
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
          captionLayout="dropdown"
          fromYear={1950}
          toYear={new Date().getFullYear()}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export default function ProfilePage() {
  const supabase = createClientBrowser();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [phone, setPhone] = useState("+595");
  const [birthDate, setBirthDate] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) {
          setLoading(false);
          return;
        }
        const u = authData.user;
        if (!active) return;
        setUserId(u.id);
        setEmail(u.email ?? "");

        const meta = (u.user_metadata ?? {}) as any;
        setFirstName((meta.first_name as string | null) ?? "");
        setLastName((meta.last_name as string | null) ?? "");
        setNationalId((meta.national_id as string | null) ?? "");
        setPhone((meta.phone as string | null) ?? "+595");
        setBirthDate((meta.birth_date as string | null) ?? "");

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("id", u.id)
          .maybeSingle();

        if (profileError || !profile) {
          setLoading(false);
          return;
        }

        const fullName: string = (profile.full_name as string | null) ?? "";
        const parts = fullName.trim().split(" ");
        const fn = parts[0] ?? "";
        const ln = parts.slice(1).join(" ") ?? "";

        if (!firstName) setFirstName(fn);
        if (!lastName) setLastName(ln);
        setAvatarUrl((profile.avatar_url as string | null) ?? null);
      } catch (e: any) {
        toast.error(e?.message ?? "Error cargando el perfil.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [supabase]);

  const initials = (() => {
    const name = `${firstName} ${lastName}`.trim();
    if (!name) return "";
    const parts = name.split(" ");
    const first = parts[0]?.[0];
    const second = parts[1]?.[0];
    return `${first ?? ""}${second ?? ""}`.toUpperCase();
  })();

  const handleSave = async () => {
    if (!userId) return;

    if (!phone.trim() || !birthDate.trim()) {
      toast.error("Completá teléfono y fecha de nacimiento.");
      return;
    }

    setSaving(true);
    try {
      const fullName = `${firstName} ${lastName}`.trim();

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName || null,
        })
        .eq("id", userId);

      if (profileError) {
        throw profileError;
      }

      await supabase.auth.updateUser({
        data: {
          first_name: firstName,
          last_name: lastName,
          national_id: nationalId,
          phone,
          birth_date: birthDate,
        },
      });

      toast.success("Perfil actualizado correctamente.");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo actualizar el perfil.");
    } finally {
      setSaving(false);
    }
  };

  const handleUploadAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!userId) return;
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const filePath = `avatars/${userId}-${Date.now()}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, {
        upsert: true,
      });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", userId);

      if (profileError) {
        throw profileError;
      }

      setAvatarUrl(publicUrl);
      toast.success("Foto de perfil actualizada.");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo actualizar la foto de perfil.");
    } finally {
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const handleRemoveAvatar = async () => {
    if (!userId || !avatarUrl) return;

    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", userId);

      if (profileError) {
        throw profileError;
      }

      setAvatarUrl(null);
      toast.success("Foto de perfil eliminada.");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo eliminar la foto de perfil.");
    }
  };

  return (
    <section className="mt-4 space-y-6 max-w-5xl mx-auto px-4">
      <div className="flex items-start gap-2">
        <UserCircle2 className="h-5 w-5 text-[#3cadaf] flex-shrink-0" />
        <div className="space-y-0.5">
          <h1 className="text-2xl font-semibold text-[#31435d]">Mi perfil</h1>
          <p className="text-sm text-gray-600">
            Revisá y actualizá tus datos personales y tu foto de perfil.
          </p>
        </div>
      </div>

      <div className="border rounded-lg bg-white shadow-sm p-4 space-y-4">
        {loading ? (
          <p className="text-sm text-gray-600">Cargando perfil...</p>
        ) : (
          <>
            {/* Bloque foto de perfil */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleUploadAvatarClick}
                className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-700 overflow-hidden hover:ring-2 hover:ring-[#3cadaf]"
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="Foto de perfil" className="h-full w-full object-cover" />
                ) : (
                  <span>{initials || "?"}</span>
                )}
              </button>

              <div className="space-y-1 text-sm">
                <p className="text-gray-700 font-medium">Foto de perfil</p>
                <p className="text-xs text-gray-500">
                  Recomendado: imagen cuadrada, mínimo 256x256 px.
                </p>
                <div className="flex flex-wrap gap-2 mt-1">
                  <Button type="button" variant="outline" size="sm" onClick={handleUploadAvatarClick}>
                    <Upload className="w-3 h-3 mr-1" /> Subir foto
                  </Button>
                  {avatarUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={handleRemoveAvatar}
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Quitar foto
                    </Button>
                  )}
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            {/* Bloque datos de perfil */}
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">Nombre</label>
                  <input
                    className="border rounded px-3 w-full h-10 text-base md:text-sm"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Apellido</label>
                  <input
                    className="border rounded px-3 w-full h-10 text-base md:text-sm"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">N° de documento</label>
                  <input
                    className="border rounded px-3 w-full h-10 text-base md:text-sm"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Teléfono (+595...)</label>
                  <input
                    className="border rounded px-3 w-full h-10 text-base md:text-sm"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">Fecha de nacimiento</label>
                  <DatePickerField value={birthDate} onChange={setBirthDate} />
                </div>
                <div>
                  <label className="block text-sm mb-1">Correo electrónico</label>
                  <input
                    type="email"
                    className="border rounded px-3 w-full h-10 text-base md:text-sm bg-gray-50 cursor-not-allowed"
                    value={email}
                    readOnly
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    El correo se usa para iniciar sesión. Si necesitás cambiarlo, contactá al administrador.
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-[#3cadaf] hover:bg-[#31435d] text-white text-sm px-4 py-2 disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Guardar cambios"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
