import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useCreateSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { nfc_uid?: string; wardrobe_number?: string; is_event_numbered?: boolean }) => {
      // If nfc_uid provided, check for existing active session
      if (data.nfc_uid) {
        const { data: existing } = await supabase
          .from('sessions')
          .select('*')
          .eq('nfc_uid', data.nfc_uid)
          .eq('status', 'active')
          .maybeSingle();
        if (existing) return existing;
      }
      const { data: session, error } = await supabase
        .from('sessions')
        .insert(data)
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
    refetchInterval: 5000,
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
