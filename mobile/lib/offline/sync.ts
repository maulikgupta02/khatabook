import { supabase } from '@/lib/supabase/client';
import { OFFLINE_SUPPORTED } from './db';
import { listPendingMutations, markMutationSynced, recordMutationFailure } from './queue';

// Mutations replay strictly in created_at order and STOP at the first failure --
// continuing past it risks a later mutation applying before an earlier one that's
// still stuck, which would silently revert the user's most recent edit once the
// earlier one finally does succeed (both target the same upsert_delivery conflict
// key). Stopping means the whole queue is blocked on one failing mutation, which is
// the safe tradeoff for a sequential ledger.
export async function syncPendingMutations(): Promise<{ synced: number; blocked: boolean }> {
  if (!OFFLINE_SUPPORTED) return { synced: 0, blocked: false };
  const pending = await listPendingMutations();
  let synced = 0;

  for (const mutation of pending) {
    const payload = JSON.parse(mutation.payload);
    const { error } =
      mutation.type === 'mark_delivery'
        ? await supabase.rpc('upsert_delivery', payload)
        : await supabase.rpc('bulk_complete_remaining', payload);

    if (error) {
      await recordMutationFailure(mutation.id, error.message);
      return { synced, blocked: true };
    }
    await markMutationSynced(mutation.id);
    synced++;
  }

  return { synced, blocked: false };
}
