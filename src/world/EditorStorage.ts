import type { EditorWorldData } from './EditorWorld';

const DB_NAME = 'massrpg-world-editor';
const DB_VERSION = 1;
const STORE_NAME = 'worlds';
const WORLD_KEY = 'twinlands-current';

const LEGACY_LOCAL_KEYS = [
  'massrpg_editor_world_v1',
  'massrpg_editor_world_v2',
  'massrpg_editor_world_v3',
  'massrpg_editor_world_v4',
  'massrpg_editor_world_v5',
];

let dbPromise: Promise<IDBDatabase> | null = null;
let writeChain: Promise<void> = Promise.resolve();

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB.'));
    request.onblocked = () => reject(new Error('IndexedDB upgrade was blocked by another tab.'));
  });
  return dbPromise;
}

export async function readEditorWorldFromIndexedDb(): Promise<unknown | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(WORLD_KEY);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error ?? new Error('Could not read editor world.'));
  });
}

function putWorld(data: EditorWorldData): Promise<void> {
  return openDb().then((db) => new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(data, WORLD_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Could not save editor world.'));
    tx.onabort = () => reject(tx.error ?? new Error('Editor world save was aborted.'));
  }));
}

/** Serializes saves so rapid editor autosaves cannot race or overwrite a newer snapshot. */
export function writeEditorWorldToIndexedDb(data: EditorWorldData): Promise<void> {
  writeChain = writeChain.catch(() => undefined).then(() => putWorld(data));
  return writeChain;
}

export async function requestPersistentEditorStorage(): Promise<void> {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist();
  } catch {
    // Persistence is an optimization. IndexedDB still works when the browser declines it.
  }
}

export function readLegacyEditorWorldRaw(): string | null {
  for (let i = LEGACY_LOCAL_KEYS.length - 1; i >= 0; i--) {
    try {
      const raw = localStorage.getItem(LEGACY_LOCAL_KEYS[i]);
      if (raw) return raw;
    } catch {
      return null;
    }
  }
  return null;
}

/** Only call after a successful IndexedDB write. This frees old localStorage quota safely. */
export function clearLegacyEditorLocalStorage(): void {
  for (const key of LEGACY_LOCAL_KEYS) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }
}

export async function estimateEditorStorage(): Promise<{ usage?: number; quota?: number }> {
  try {
    const estimate = await navigator.storage?.estimate?.();
    return { usage: estimate?.usage, quota: estimate?.quota };
  } catch {
    return {};
  }
}
