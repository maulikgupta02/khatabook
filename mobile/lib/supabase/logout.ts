import { router } from 'expo-router';
import { supabase } from '@/lib/supabase/client';

export async function logout() {
  await supabase.auth.signOut();
  router.replace('/(auth)/login');
}
