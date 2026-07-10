import { useEffect, useState, useCallback } from 'react';
import { supabase } from './client';
import { useSession } from './useSession';

export function useShop() {
  const { session } = useSession();
  const [shopId, setShopId] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    if (!session) {
      setShopId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from('shop_owner_profiles')
      .select('shop_id, full_name')
      .eq('user_id', session.user.id)
      .single()
      .then(({ data }) => {
        setShopId(data?.shop_id ?? null);
        setFullName(data?.full_name ?? null);
        setLoading(false);
      });
  }, [session?.user.id]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { shopId, fullName, loading, reload };
}
