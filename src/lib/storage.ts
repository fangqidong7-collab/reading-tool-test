const DB_NAME = "english-reader-db";
const DB_VERSION = 2;
const STORE_NAME = "keyval";

// New storage keys for per-book storage
export const BOOK_INDEX_KEY = "book_index";
export const BOOK_DATA_PREFIX = "book_data_";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function idbGet(key: string): Promise<string | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("idbGet failed:", e);
    return null;
  }
}

export async function idbSet(key: string, value: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("idbSet failed:", e);
  }
}

export async function idbRemove(key: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("idbRemove failed:", e);
  }
}

/**
 * Get all keys that start with a given prefix
 */
export async function idbGetAll(prefix: string): Promise<string[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAllKeys();
      req.onsuccess = () => {
        const keys = req.result
          .filter((key) => typeof key === "string" && key.startsWith(prefix))
          .map((key) => key as string);
        resolve(keys);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("idbGetAll failed:", e);
    return [];
  }
}

/**
 * Get multiple values by keys
 */
export async function idbGetMulti(keys: string[]): Promise<Record<string, string | null>> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const result: Record<string, string | null> = {};
      
      keys.forEach((key) => {
        const req = store.get(key);
        req.onsuccess = () => {
          result[key] = req.result ?? null;
        };
      });

      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("idbGetMulti failed:", e);
    return {};
  }
}
