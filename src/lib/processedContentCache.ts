import type { ProcessedContent } from '@/hooks/useBookshelf';
import { idbGet, idbRemove, idbSet } from '@/lib/storage';

const CACHE_PREFIX = 'processed_content:v3:';

function cacheKey(bookId: string, contentHash: string): string {
  return `${CACHE_PREFIX}${bookId}:${contentHash}`;
}

export async function loadProcessedContentCache(
  bookId: string,
  contentHash: string,
): Promise<ProcessedContent | null> {
  try {
    const raw = await idbGet(cacheKey(bookId, contentHash));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProcessedContent;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveProcessedContentCache(
  bookId: string,
  contentHash: string,
  content: ProcessedContent,
): Promise<void> {
  if (!bookId || !contentHash || content.length === 0) return;
  try {
    await idbSet(cacheKey(bookId, contentHash), JSON.stringify(content));
  } catch (e) {
    console.warn('saveProcessedContentCache failed:', e);
  }
}

export async function removeProcessedContentCacheForBook(bookId: string): Promise<void> {
  if (!bookId || typeof indexedDB === 'undefined') return;
  try {
    const dbName = 'english-reader-db';
    const request = indexedDB.open(dbName);
    await new Promise<void>((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('keyval', 'readwrite');
        const store = tx.objectStore('keyval');
        const prefix = `${CACHE_PREFIX}${bookId}:`;
        const cursorReq = store.openCursor();
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (!cursor) return;
          const key = String(cursor.key);
          if (key.startsWith(prefix)) {
            cursor.delete();
          }
          cursor.continue();
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
    });
  } catch {
    // Fallback: cannot enumerate keys with idbRemove only — best-effort no-op
    void idbRemove(cacheKey(bookId, ''));
  }
}
