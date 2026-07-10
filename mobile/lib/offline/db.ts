import { Platform } from 'react-native';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

// Offline support targets the delivery round on a native Android/iOS device (per
// spec: a delivery worker walking door to door). Web always has a connection to the
// dev/prod server it's served from, so it stays online-only rather than pulling in
// expo-sqlite's WASM/IndexedDB web backing for a scenario that doesn't apply there.
export const OFFLINE_SUPPORTED = Platform.OS !== 'web';

let db: SQLiteDatabase | null = null;

function getDb(): SQLiteDatabase {
  if (!OFFLINE_SUPPORTED) {
    throw new Error('Offline storage is not available on web');
  }
  if (!db) {
    db = openDatabaseSync('khatabook.db');
  }
  return db;
}

let migrated = false;

export async function ensureOfflineSchema() {
  if (!OFFLINE_SUPPORTED || migrated) return;
  const database = getDb();
  await database.execAsync(`
    create table if not exists mutation_queue (
      id text primary key,
      type text not null,
      payload text not null,
      status text not null default 'pending',
      retry_count integer not null default 0,
      error text,
      created_at text not null
    );
    create table if not exists today_cache (
      shop_id text not null,
      delivery_date text not null,
      data text not null,
      cached_at text not null,
      primary key (shop_id, delivery_date)
    );
  `);
  migrated = true;
}

export { getDb };
