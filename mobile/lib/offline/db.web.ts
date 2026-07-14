import type { SQLiteDatabase } from 'expo-sqlite';

// Metro picks this file over db.ts when bundling for web (platform-extension resolution),
// so expo-sqlite -- and its wasm worker, which Metro can't resolve without extra config --
// never enters the web bundle graph at all. Every caller already checks OFFLINE_SUPPORTED
// before calling getDb/ensureOfflineSchema, so these bodies are unreachable in practice;
// they exist only to satisfy the shared import surface.
export const OFFLINE_SUPPORTED = false;

function getDb(): SQLiteDatabase {
  throw new Error('Offline storage is not available on web');
}

export async function ensureOfflineSchema() {}

export { getDb };
