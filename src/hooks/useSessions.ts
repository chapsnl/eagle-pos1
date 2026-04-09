import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useCreateSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { nfc_uid?: string; wardrobe_number?: string; is_event_numbered?: boolean; lookup_wardrobe?: string }) => {
      const { lookup_wardrobe, ...insertData } = data;

      // Priority 1: lookup by wardrobe_number (primary customer ID)
      if (lookup_wardrobe) {
        const { data: existing } = await supabase
          .from('sessions')
          .select('*')
          .eq('status', 'active')
          .eq('wardrobe_number', lookup_wardrobe.replace(/[CB]/g, ''))
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (existing) {
          // Update NFC UID on existing session if provided and missing
          if (insertData.nfc_uid && !existing.nfc_uid) {
            await supabase.from('sessions').update({ nfc_uid: insertData.nfc_uid }).eq('id', existing.id);
          }
          return existing;
        }
      }

      // Priority 2: lookup by nfc_uid (backup identifier)
      if (insertData.nfc_uid) {
        const { data: existing } = await supabase
          .from('sessions')
          .select('*')
          .eq('nfc_uid', insertData.nfc_uid)
          .eq('status', 'active')
          .maybeSingle();
        if (existing) return existing;
      }

      const { data: session, error } = await supabase
        .from('sessions')
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;
      return session;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  });
};

export const useFindActiveSessionByWardrobe = () => {
  return useMutation({
    mutationFn: async (wardrobeNumber: string) => {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('wardrobe_number', wardrobeNumber)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
};

export const useUpdateSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; status?: 'active' | 'paid' | 'incident' | 'archived'; total_amount?: number; actual_paid_amount?: number; wardrobe_number?: string }) => {
      const { error } = await supabase
        .from('sessions')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  });
};

export const useActiveSessions = () => {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('active-sessions-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions' }, (payload) => {
        qc.setQueryData(['sessions', 'active'], (old: any[] | undefined) => {
          if (!old) return old;
          const updated = payload.new as any;
          if (updated.status !== 'active') return old.filter(s => s.id !== updated.id);
          return old.map(s => s.id === updated.id ? { ...s, ...updated } : s);
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sessions' }, (payload) => {
        qc.setQueryData(['sessions', 'active'], (old: any[] | undefined) => {
          const inserted = payload.new as any;
          if (inserted.status !== 'active') return old;
          if (!old) return [inserted];
          if (old.some(s => s.id === inserted.id)) return old;
          return [...old, inserted];
        });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'sessions' }, (payload) => {
        qc.setQueryData(['sessions', 'active'], (old: any[] | undefined) =>
          old?.filter(s => s.id !== (payload.old as any).id)
        );
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drink_logs' }, (payload) => {
        const sessionId = (payload.new as any)?.session_id || (payload.old as any)?.session_id;
        if (sessionId) {
          qc.invalidateQueries({ queryKey: ['session-detail', sessionId] });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  return useQuery({
    queryKey: ['sessions', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('*, drink_logs(*, products(*))')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: Infinity,
    refetchOnWindowFocus: true,
  });
};

export const useIncidentSessions = () => {
  return useQuery({
    queryKey: ['sessions', 'incidents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('*, drink_logs(*, products(*))')
        .eq('status', 'incident')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
};

export const useAddDrinkLog = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { session_id: string; product_id: string; price_at_time: number }) => {
      const { error } = await supabase
        .from('drink_logs')
        .insert(data);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  });
};

export const useAddDrinkLogs = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (logs: { session_id: string; product_id: string; price_at_time: number }[]) => {
      const { error } = await supabase
        .from('drink_logs')
        .insert(logs);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  });
};
