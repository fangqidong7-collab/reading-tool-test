const CACHE_MAX_ENTRIES = 2000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface ServerCacheEntry {
  translation: string;
  savedAt: number;
}

const wordTranslationCache = new Map<string, ServerCacheEntry>();

export function getServerTranslationCache(key: string): string | null {
  const entry = wordTranslationCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.savedAt > CACHE_TTL_MS) {
    wordTranslationCache.delete(key);
    return null;
  }
  return entry.translation;
}

export function setServerTranslationCache(key: string, translation: string): void {
  if (!translation) return;
  wordTranslationCache.set(key, { translation, savedAt: Date.now() });
  if (wordTranslationCache.size <= CACHE_MAX_ENTRIES) return;
  const oldest = [...wordTranslationCache.entries()]
    .sort((a, b) => a[1].savedAt - b[1].savedAt)
    .slice(0, wordTranslationCache.size - CACHE_MAX_ENTRIES);
  for (const [k] of oldest) {
    wordTranslationCache.delete(k);
  }
}

export function buildWordCacheKey(lang: string, word: string): string {
  return `${lang}:${word.toLowerCase().trim()}`;
}
