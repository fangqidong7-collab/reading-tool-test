import { recordLookupTiming } from '@/lib/lookupTiming';

const FAILED_MEANINGS = new Set([
  '翻译失败', '翻译超时', '未找到释义',
  'Definition failed', 'Timeout', 'No definition found',
]);

export function isTranslationError(s: string | undefined | null): boolean {
  if (!s) return true;
  return FAILED_MEANINGS.has(s.replace(/\.{3}$/, ''));
}

const CACHE_KEY = 'reading_translation_cache_v2';
const LEGACY_CACHE_KEY = 'translation_cache';
const CACHE_MAX_ENTRIES = 5000;
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface CacheEntry {
  value: string;
  savedAt: number;
}

let translationCache: Record<string, CacheEntry> = {};
const inFlightRequests = new Map<string, Promise<string>>();

function loadCacheFromStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const saved = localStorage.getItem(CACHE_KEY);
    if (saved) {
      translationCache = JSON.parse(saved) as Record<string, CacheEntry>;
      pruneTranslationCache();
      return;
    }
    const legacy = sessionStorage.getItem(LEGACY_CACHE_KEY);
    if (legacy) {
      const legacyMap = JSON.parse(legacy) as Record<string, string>;
      const now = Date.now();
      for (const [key, value] of Object.entries(legacyMap)) {
        if (value && !isTranslationError(value)) {
          translationCache[key] = { value, savedAt: now };
        }
      }
      saveCacheToStorage();
      sessionStorage.removeItem(LEGACY_CACHE_KEY);
    }
  } catch {
    translationCache = {};
  }
}

function saveCacheToStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(translationCache));
  } catch {
    pruneTranslationCache(true);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(translationCache));
    } catch {
      /* ignore quota errors */
    }
  }
}

function pruneTranslationCache(aggressive = false): void {
  const now = Date.now();
  for (const [key, entry] of Object.entries(translationCache)) {
    if (!entry?.value || now - entry.savedAt > CACHE_TTL_MS) {
      delete translationCache[key];
    }
  }
  const keys = Object.keys(translationCache);
  const limit = aggressive ? Math.floor(CACHE_MAX_ENTRIES * 0.7) : CACHE_MAX_ENTRIES;
  if (keys.length <= limit) return;
  keys
    .sort((a, b) => translationCache[a].savedAt - translationCache[b].savedAt)
    .slice(0, keys.length - limit)
    .forEach((key) => delete translationCache[key]);
}

function getCachedTranslation(cacheKey: string): string | null {
  const entry = translationCache[cacheKey];
  if (!entry) return null;
  if (Date.now() - entry.savedAt > CACHE_TTL_MS) {
    delete translationCache[cacheKey];
    return null;
  }
  return entry.value;
}

function setCachedTranslation(cacheKey: string, value: string): void {
  if (!value || isTranslationError(value)) return;
  translationCache[cacheKey] = { value, savedAt: Date.now() };
  pruneTranslationCache();
  saveCacheToStorage();
}

loadCacheFromStorage();

async function requestTranslation(
  word: string,
  lang: 'zh' | 'en' | 'en-simple' = 'zh',
): Promise<string> {
  const lowerWord = word.toLowerCase().trim();
  const cacheKey = `${lang}:${lowerWord}`;
  const isEnglishLang = lang === 'en' || lang === 'en-simple';

  const cached = getCachedTranslation(cacheKey);
  if (cached) {
    recordLookupTiming('ai-cache', 0);
    return cached;
  }

  const pending = inFlightRequests.get(cacheKey);
  if (pending) return pending;

  const promise = (async () => {
    const start = typeof performance !== 'undefined' ? performance.now() : 0;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ word: lowerWord, lang }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('Translation API error');
      }

      const data = await response.json();
      const translation =
        data.translation || (isEnglishLang ? 'No definition found' : '未找到释义');

      if (typeof performance !== 'undefined') {
        recordLookupTiming('ai-network', performance.now() - start);
      }

      setCachedTranslation(cacheKey, translation);
      return translation;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return isEnglishLang ? 'Timeout' : '翻译超时';
      }
      console.error('Translation error:', error);
      return isEnglishLang ? 'Definition failed' : '翻译失败';
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, promise);
  return promise;
}

/**
 * Translate English word to Chinese
 */
export async function translateWord(word: string): Promise<string> {
  return requestTranslation(word, 'zh');
}

/**
 * Define English word in English (short)
 */
export async function translateWordEn(word: string): Promise<string> {
  return requestTranslation(word, 'en');
}

/**
 * Define English word in easy English (longer, using basic vocabulary)
 */
export async function translateWordEnSimple(word: string): Promise<string> {
  return requestTranslation(word, 'en-simple');
}

/**
 * Translate an English sentence to Chinese
 */
export async function translateSentence(sentence: string): Promise<string> {
  const trimmed = sentence.trim();
  const cacheKey = `sentence:${trimmed}`;

  const cached = getCachedTranslation(cacheKey);
  if (cached) {
    recordLookupTiming('ai-cache', 0);
    return cached;
  }

  const pending = inFlightRequests.get(cacheKey);
  if (pending) return pending;

  const promise = (async () => {
    const start = typeof performance !== 'undefined' ? performance.now() : 0;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'sentence', sentence: trimmed }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('Sentence translation API error');
      }

      const data = await response.json();
      const translation = data.translation || '翻译失败';

      if (typeof performance !== 'undefined') {
        recordLookupTiming('ai-network', performance.now() - start);
      }

      setCachedTranslation(cacheKey, translation);
      return translation;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return '翻译超时';
      }
      console.error('Sentence translation error:', error);
      return '翻译失败';
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, promise);
  return promise;
}
