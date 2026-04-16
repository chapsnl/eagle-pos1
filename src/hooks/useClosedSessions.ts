import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const CLOSED_SESSIONS_QUERY_KEY = ['closed-sessions'] as const;

export const useClosedSessions = () => {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('closed-sessions-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drink_logs' },
        () => {
          qc.invalidateQueries({ queryKey: CLOSED_SESSIONS_QUERY_KEY });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions' },
        () => {
          qc.invalidateQueries({ queryKey: CLOSED_SESSIONS_QUERY_KEY });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return useQuery({
    queryKey: CLOSED_SESSIONS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('*, drink_logs(*, products(*))')
        .in('status', ['paid', 'archived'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
};