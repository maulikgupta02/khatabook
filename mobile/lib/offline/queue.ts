import * as Crypto from 'expo-crypto';
import { ensureOfflineSchema, getDb } from './db';

export type MutationType = 'mark_delivery' | 'bulk_complete';

export type QueuedMutation = {
  id: string;
  type: MutationType;
  payload: string;
  status: 'pending' | 'synced';
  retry_count: number;
  error: string | null;
  created_at: string;
};

export async function enqueueMutation(type: MutationType, payload: Record<string, unknown>): Promise<string> {
  await ensureOfflineSchema();
  const id = Crypto.randomUUID();
  const db = getDb();
  await db.runAsync(
    'insert into mutation_queue (id, type, payload, status, created_at) values (?, ?, ?, ?, ?)',
    id,
    type,
    JSON.stringify(payload),
    'pending',
    new Date().toISOString()
  );
  return id;
}

export async function listPendingMutations(): Promise<QueuedMutation[]> {
  await ensureOfflineSchema();
  const db = getDb();
  return db.getAllAsync<QueuedMutation>(
    "select * from mutation_queue where status = 'pending' order by created_at asc"
  );
}

export async function countPendingMutations(): Promise<number> {
  await ensureOfflineSchema();
  const db = getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    "select count(*) as count from mutation_queue where status = 'pending'"
  );
  return row?.count ?? 0;
}

export async function markMutationSynced(id: string) {
  const db = getDb();
  await db.runAsync("update mutation_queue set status = 'synced' where id = ?", id);
}

// Deliberately does NOT change status away from 'pending' -- mutations must replay in
// created_at order (a later "Changed" can depend on an earlier "Delivered" existing
// first). If this one failed, later ones must wait for it too, so the next sync pass
// picks it back up automatically instead of needing an explicit retry step.
export async function recordMutationFailure(id: string, error: string) {
  const db = getDb();
  await db.runAsync('update mutation_queue set retry_count = retry_count + 1, error = ? where id = ?', error, id);
}
