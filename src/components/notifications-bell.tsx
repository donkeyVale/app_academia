"use client";

import { useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClientBrowser } from '@/lib/supabase';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  data: any;
  created_at: string;
  read_at: string | null;
};

export function NotificationsBell() {
  const supabase = createClientBrowser();
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedAcademyId, setSelectedAcademyId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem('selectedAcademyId');
  });
  const [academyReady, setAcademyReady] = useState(() => typeof window !== 'undefined');

  const unreadLabel = useMemo(() => {
    if (unreadCount <= 0) return '';
    if (unreadCount > 99) return '99+';
    return String(unreadCount);
  }, [unreadCount]);

  const load = async (uid: string) => {
    if (!academyReady) return;
    if (!selectedAcademyId) return;
    setLoading(true);
    try {
      let listQ = supabase
        .from('notifications')
        .select('id,title,body,data,created_at,read_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(20);

      let countQ = supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid)
        .is('read_at', null);

      listQ = listQ.eq('data->>academyId', selectedAcademyId);
      countQ = countQ.eq('data->>academyId', selectedAcademyId);

      const [listRes, countRes] = await Promise.all([listQ, countQ]);

      if (!listRes.error) {
        setItems((listRes.data ?? []) as any);
      }

      setUnreadCount(countRes.count ?? 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id as string | undefined;
      if (!active) return;
      if (!uid) return;
      setUserId(uid);
    })();

    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const read = () => {
      const v = window.localStorage.getItem('selectedAcademyId');
      setSelectedAcademyId(v || null);
    };

    read();
    setAcademyReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'selectedAcademyId') read();
    };
    const onAcademyChanged = () => {
      read();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('selectedAcademyIdChanged', onAcademyChanged);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('selectedAcademyIdChanged', onAcademyChanged);
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    if (!academyReady) return;
    if (!selectedAcademyId) return;
    load(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, selectedAcademyId, academyReady]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          if (!academyReady) return;
          if (!selectedAcademyId) return;
          load(userId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  const markOneRead = async (id: string) => {
    if (!userId) return;
    const now = new Date().toISOString();
    await supabase.from('notifications').update({ read_at: now }).eq('id', id);
  };

  const markAllRead = async () => {
    if (!userId) return;
    if (!academyReady) return;
    if (!selectedAcademyId) return;
    const now = new Date().toISOString();
    let q = supabase.from('notifications').update({ read_at: now }).eq('user_id', userId).is('read_at', null);
    q = q.eq('data->>academyId', selectedAcademyId);
    await q;
  };

  const handleOpen = async () => {
    setOpen(true);
    if (userId) await load(userId);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v && userId) {
          load(userId);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={() => {
            if (open) setOpen(false);
            else void handleOpen();
          }}
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          aria-label="Notificaciones"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-[18px] text-white">
              {unreadLabel}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-slate-800">Notificaciones</div>
          <button
            type="button"
            onClick={() => void markAllRead()}
            disabled={unreadCount === 0}
            className="text-[11px] font-semibold text-[#3cadaf] disabled:opacity-50"
          >
            Marcar todo leído
          </button>
        </div>
        <div className="mt-2">
          {loading ? (
            <div className="text-xs text-slate-500">Cargando...</div>
          ) : items.length === 0 ? (
            <div className="text-xs text-slate-500">No tenés notificaciones.</div>
          ) : (
            <div className="max-h-96 overflow-auto divide-y">
              {items.map((n) => {
                const url = (n.data as any)?.url as string | undefined;
                const isUnread = !n.read_at;
                return (
                  <button
                    key={n.id}
                    type="button"
                    className={
                      'w-full text-left px-2 py-2 hover:bg-slate-50 ' +
                      (isUnread ? 'bg-[#e6f5f6]/40' : '')
                    }
                    onClick={async () => {
                      if (isUnread) await markOneRead(n.id);
                      setOpen(false);
                      if (url) router.push(url);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-800 truncate">{n.title}</div>
                        {n.body && <div className="mt-0.5 text-[11px] text-slate-600 break-words">{n.body}</div>}
                      </div>
                      {isUnread && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#3cadaf]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
