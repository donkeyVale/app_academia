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

type Props = {
  userId: string;
  onUnreadCountChange?: (count: number) => void;
};

export function NotificationsMenuItem({ userId, onUnreadCountChange }: Props) {
  const supabase = createClientBrowser();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const unreadLabel = useMemo(() => {
    if (unreadCount <= 0) return '';
    if (unreadCount > 99) return '99+';
    return String(unreadCount);
  }, [unreadCount]);

  const load = async () => {
    setLoading(true);
    try {
      const [listRes, countRes] = await Promise.all([
        supabase
          .from('notifications')
          .select('id,title,body,data,created_at,read_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('read_at', null),
      ]);

      if (!listRes.error) {
        setItems((listRes.data ?? []) as any);
      }

      const nextCount = countRes.count ?? 0;
      setUnreadCount(nextCount);
      onUnreadCountChange?.(nextCount);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
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
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, userId]);

  const markOneRead = async (id: string) => {
    const now = new Date().toISOString();
    await supabase.from('notifications').update({ read_at: now }).eq('id', id);
  };

  const markAllRead = async () => {
    const now = new Date().toISOString();
    await supabase.from('notifications').update({ read_at: now }).eq('user_id', userId).is('read_at', null);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          load();
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between gap-2 px-3.5 py-2 hover:bg-gray-50 text-left"
        >
          <span className="flex items-center gap-2">
            <Bell className="w-3.5 h-3.5" />
            <span>Notificaciones</span>
          </span>
          {unreadCount > 0 && (
            <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-[18px] text-white">
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
                    className={'w-full text-left px-2 py-2 hover:bg-slate-50 ' + (isUnread ? 'bg-[#e6f5f6]/40' : '')}
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
