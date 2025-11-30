"use client";

import Link from "next/link";
import Image from "next/image";
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

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Editor de recorte (pan/zoom) en cliente
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropZoom, setCropZoom] = useState(1); // 1x-3x
  const [cropOffsetX, setCropOffsetX] = useState(0); // porcentaje -50 a 50
  const [cropOffsetY, setCropOffsetY] = useState(0); // porcentaje -50 a 50
  const [cropping, setCropping] = useState(false);
  const dragStateRef = useRef<{
    dragging: boolean;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);

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
        setAvatarUrl((meta.avatar_url as string | null) ?? null);

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("full_name")
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

  const handleChangePassword = async () => {
    if (!userId || !email) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Completá todos los campos de contraseña.");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("La nueva contraseña y su confirmación no coinciden.");
      return;
    }

    setChangingPassword(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error("La contraseña actual no es correcta.");
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      toast.success("Contraseña actualizada correctamente.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo actualizar la contraseña.");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleUploadAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          setCropSrc(result);
          setCropZoom(1.4);
          setCropOffsetX(0);
          setCropOffsetY(0);
        }
      };
      reader.readAsDataURL(file);
    } catch (e: any) {
      toast.error(e?.message ?? 'No se pudo cargar la imagen para recorte.');
    } finally {
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleApplyCroppedAvatar = async () => {
    if (!userId || !cropSrc) return;

    try {
      setCropping(true);

      const image = new window.Image();
      image.src = cropSrc;

      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('No se pudo cargar la imagen para recorte.'));
      });

      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No se pudo inicializar el canvas.');

      const imgW = image.width;
      const imgH = image.height;
      const baseScale = Math.max(size / imgW, size / imgH);
      const scale = baseScale * cropZoom;

      const offsetXPx = (cropOffsetX / 100) * size;
      const offsetYPx = (cropOffsetY / 100) * size;

      const drawX = size / 2 - (imgW * scale) / 2 + offsetXPx;
      const drawY = size / 2 - (imgH * scale) / 2 + offsetYPx;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(image, drawX, drawY, imgW * scale, imgH * scale);

      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92),
      );
      if (!blob) throw new Error('No se pudo generar la imagen recortada.');

      const formData = new FormData();
      formData.append('userId', userId);
      formData.append('file', blob, 'avatar.jpg');

      const res = await fetch('/api/profile/upload-avatar', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? 'No se pudo actualizar la foto de perfil.');
      }

      const url = json.url as string;
      setAvatarUrl(url);
      setCropSrc(null);
      toast.success('Foto de perfil actualizada.');
    } catch (e: any) {
      toast.error(e?.message ?? 'No se pudo actualizar la foto de perfil.');
    } finally {
      setCropping(false);
    }
  };

  const handleCropPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!cropSrc) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragStateRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: cropOffsetX,
      startOffsetY: cropOffsetY,
    };
  };

  const handleCropPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current || !dragStateRef.current.dragging) return;
    const { startX, startY, startOffsetX, startOffsetY } = dragStateRef.current;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    // Escalar deltas a porcentaje aprox. según tamaño de preview
    const factor = 0.3; // ajustar sensibilidad
    let nextX = startOffsetX + deltaX * factor;
    let nextY = startOffsetY + deltaY * factor;

    // Limitar a rango razonable
    nextX = Math.max(-80, Math.min(80, nextX));
    nextY = Math.max(-80, Math.min(80, nextY));

    setCropOffsetX(nextX);
    setCropOffsetY(nextY);
  };

  const handleCropPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current && dragStateRef.current.dragging) {
      dragStateRef.current = null;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
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
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2">
          <UserCircle2 className="h-5 w-5 text-[#3cadaf] flex-shrink-0" />
          <div className="space-y-0.5">
            <h1 className="text-2xl font-semibold text-[#31435d]">Mi perfil</h1>
            <p className="text-sm text-gray-600">
              Revisá y actualizá tus datos personales y tu foto de perfil.
            </p>
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
                className="h-24 w-24 rounded-full bg-gray-200 flex items-center justify-center text-base font-medium text-gray-700 overflow-hidden hover:ring-2 hover:ring-[#3cadaf]"
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt="Foto de perfil"
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-xl">{initials || "?"}</span>
                )}
              </button>

              <div className="space-y-1 text-sm">
                <p className="text-gray-700 font-medium">Foto de perfil</p>
                <p className="text-xs text-gray-500">
                  Recomendado: imagen cuadrada, mínimo 256x256 px.
                </p>
                {cropSrc && (
                  <div className="mt-3 space-y-3 border-t pt-3">
                    <p className="text-xs text-gray-600 font-medium">Ajustar recorte</p>
                    <div className="flex items-center gap-4">
                      <div
                        className="h-20 w-20 rounded-full border border-gray-300 overflow-hidden bg-gray-100 flex items-center justify-center touch-pan-y touch-pan-x"
                      >
                        {/* Vista previa circular del recorte */}
                        <div
                          className="relative h-24 w-24"
                          onPointerDown={handleCropPointerDown}
                          onPointerMove={handleCropPointerMove}
                          onPointerUp={handleCropPointerUp}
                          onPointerCancel={handleCropPointerUp}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={cropSrc}
                            alt="Vista previa"
                            className="absolute inset-0 w-full h-full object-cover select-none"
                            style={{
                              transform: `scale(${cropZoom}) translate(${cropOffsetX}%, ${cropOffsetY}%)`,
                              touchAction: "none",
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex-1 space-y-2 text-xs">
                        <div>
                          <label className="block text-[11px] text-gray-600 mb-1">Zoom</label>
                          <input
                            type="range"
                            min={1}
                            max={3}
                            step={0.1}
                            value={cropZoom}
                            onChange={(e) => setCropZoom(Number(e.target.value))}
                            className="w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-gray-600 mb-1">Mover horizontal</label>
                          <input
                            type="range"
                            min={-50}
                            max={50}
                            value={cropOffsetX}
                            onChange={(e) => setCropOffsetX(Number(e.target.value))}
                            className="w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-gray-600 mb-1">Mover vertical</label>
                          <input
                            type="range"
                            min={-50}
                            max={50}
                            value={cropOffsetY}
                            onChange={(e) => setCropOffsetY(Number(e.target.value))}
                            className="w-full"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Button
                        type="button"
                        size="sm"
                        className="bg-[#3cadaf] hover:bg-[#31435d] text-white px-3 py-1.5 disabled:opacity-50"
                        onClick={handleApplyCroppedAvatar}
                        disabled={cropping}
                      >
                        {cropping ? "Guardando recorte..." : "Aplicar recorte y guardar"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="px-3 py-1.5"
                        onClick={() => setCropSrc(null)}
                        disabled={cropping}
                      >
                        Cancelar recorte
                      </Button>
                    </div>
                  </div>
                )}
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

            <div className="mt-6 pt-4 border-t border-gray-200 space-y-3 text-sm">
              <h2 className="text-base font-semibold text-[#31435d]">Cambiar contraseña</h2>
              <p className="text-xs text-gray-500">
                Para cambiar tu contraseña, ingresá la actual y luego la nueva contraseña dos veces para confirmarla.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">Contraseña actual</label>
                  <input
                    type="password"
                    className="border rounded px-3 w-full h-10 text-base md:text-sm"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Nueva contraseña</label>
                  <input
                    type="password"
                    className="border rounded px-3 w-full h-10 text-base md:text-sm"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">Repetir nueva contraseña</label>
                  <input
                    type="password"
                    className="border rounded px-3 w-full h-10 text-base md:text-sm"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  onClick={handleChangePassword}
                  disabled={changingPassword}
                  className="bg-[#31435d] hover:bg-[#1f2937] text-white text-sm px-4 py-2 disabled:opacity-50"
                >
                  {changingPassword ? "Actualizando..." : "Actualizar contraseña"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
