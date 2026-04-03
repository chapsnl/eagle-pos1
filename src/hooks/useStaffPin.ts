import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const FALLBACK_PIN = import.meta.env.VITE_STAFF_PIN ?? '';

export const useStaffPin = () => {
  return useQuery({
    queryKey: ['settings', 'staff_pin'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('settings')
        .select('value')
        .eq('key', 'staff_pin')
        .maybeSingle();
      if (error || !data) return FALLBACK_PIN;
      return data.value as string;
    },
    staleTime: 1000 * 60,
  });
};

export const useUpdateStaffPin = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (newPin: string) => {
      const { error } = await (supabase as any)
        .from('settings')
        .upsert({ key: 'staff_pin', value: newPin });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'staff_pin'] }),
  });
};
