import { useEffect, useState, useCallback } from 'react';
import { supabase } from './client';
import { useSession } from './useSession';
import type { Customer } from './types';

export function useCustomer() {
  const { session } = useSession();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    if (!session) {
      setCustomer(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from('customers')
      .select('*')
      .eq('auth_user_id', session.user.id)
      .single()
      .then(({ data }) => {
        setCustomer(data ?? null);
        setLoading(false);
      });
  }, [session?.user.id]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { customer, loading, reload };
}
