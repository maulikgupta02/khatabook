import { ensureOfflineSchema, getDb } from './db';

export async function saveTodayCache(shopId: string, date: string, data: unknown) {
  await ensureOfflineSchema();
  const db = getDb();
  await db.runAsync(
    `insert into today_cache (shop_id, delivery_date, data, cached_at) values (?, ?, ?, ?)
     on conflict (shop_id, delivery_date) do update set data = excluded.data, cached_at = excluded.cached_at`,
    shopId,
    date,
    JSON.stringify(data),
    new Date().toISOString()
  );
}

export async function loadTodayCache<T>(shopId: string, date: string): Promise<T | null> {
  await ensureOfflineSchema();
  const db = getDb();
  const row = await db.getFirstAsync<{ data: string }>(
    'select data from today_cache where shop_id = ? and delivery_date = ?',
    shopId,
    date
  );
  return row ? (JSON.parse(row.data) as T) : null;
}
