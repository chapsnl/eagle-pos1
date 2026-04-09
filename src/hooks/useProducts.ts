import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DbProduct {
  id: string;
  shorthand: string;
  full_name: string;
  category_color: string;
  price: number;
  stock_count: number;
}

const dark = (hex: string) => ['#12100e', '#357cff', '#497df7'].includes(hex);

export const useProducts = () => {
  return useQuery({
    queryKey: ['products'],
    queryFn: async (): Promise<DbProduct[]> => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('shorthand');
      if (error) throw error;
      return (data ?? []) as DbProduct[];
    },
    staleTime: 1000 * 60 * 60 * 8, // 8 hours — full shift
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
};

export const getTextColor = (hex: string) => dark(hex) ? '#ffffff' : '#12100e';
