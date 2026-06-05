// Dictionary Loader - External Dictionary Loading and Caching

export interface DictEntry {
  meaning: string;
  pos?: string; // Optional since new dict.json uses simple string format
}

export interface DictData {
  // New format: simple key-value
  [word: string]: string;
}

// Legacy format support
export interface LegacyDictData {
  version: string;
  description: string;
  entries: Record<string, DictEntry>;
}

export type DictLoadStatus = 'idle' | 'loading' | 'loaded' | 'failed';

// Global state for external dictionary
let externalDict: Record<string, string> = {};
let loadStatus: DictLoadStatus = 'idle';
let loadError: string | null = null;

// Cache key for localStorage
const CACHE_KEY = 'reading_assistant_ext_dict';
const CACHE_VERSION_KEY = 'reading_assistant_dict_version';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// English-English dictionary state
let externalDictEn: Record<string, string> = {};
let loadStatusEn: DictLoadStatus = 'idle';
const CACHE_KEY_EN = 'reading_assistant_ext_dict_en';
const CACHE_VERSION_KEY_EN = 'reading_assistant_dict_en_version';

let zhRefreshPromise: Promise<DictLoadStatus> | null = null;
let enRefreshPromise: Promise<DictLoadStatus> | null = null;

function getDictFetchUrl(filename: string): string {
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return `${window.location.protocol}//${window.location.host}/${filename}`;
  }
  return `/${filename}`;
}

function parseDictPayload(data: DictData | LegacyDictData): Record<string, string> {
  if ('entries' in data && data.entries) {
    const entries = data.entries;
    const parsed: Record<string, string> = {};
    for (const [word, entry] of Object.entries(entries)) {
      parsed[word] = typeof entry === 'string' ? entry : (entry as DictEntry).meaning;
    }
    return parsed;
  }
  return data as unknown as Record<string, string>;
}

async function registerExternalWords(words: string[]): Promise<void> {
  try {
    const { registerKnownWords } = await import('@/lib/dictionary');
    registerKnownWords(words);
  } catch {
    /* dictionary module not available */
  }
}

function applyExternalDict(dict: Record<string, string>): void {
  externalDict = dict;
  loadStatus = 'loaded';
  void registerExternalWords(Object.keys(externalDict));
}

function applyExternalDictEn(dict: Record<string, string>): void {
  externalDictEn = dict;
  loadStatusEn = 'loaded';
}

/**
 * 同步从 localStorage 恢复外部词典，供启动后立即可查。
 */
export function hydrateExternalDictionaryFromCache(): boolean {
  if (loadStatus === 'loaded' && Object.keys(externalDict).length > 0) {
    return true;
  }
  const cached = loadFromCache();
  if (cached && Object.keys(cached).length > 0) {
    applyExternalDict(cached);
    return true;
  }
  return false;
}

export function hydrateExternalDictionaryEnFromCache(): boolean {
  if (loadStatusEn === 'loaded' && Object.keys(externalDictEn).length > 0) {
    return true;
  }
  const cached = loadEnFromCache();
  if (cached && Object.keys(cached).length > 0) {
    applyExternalDictEn(cached);
    return true;
  }
  return false;
}

async function fetchExternalDictionaryFromNetwork(): Promise<Record<string, string>> {
  const response = await fetch(getDictFetchUrl('dict.json'));
  if (!response.ok) {
    throw new Error(`Failed to load dictionary: ${response.status}`);
  }
  const data: DictData | LegacyDictData = await response.json();
  return parseDictPayload(data);
}

async function fetchExternalDictionaryEnFromNetwork(): Promise<Record<string, string>> {
  const response = await fetch(getDictFetchUrl('dict_en.json'));
  if (!response.ok) {
    throw new Error(`Failed to load English dictionary: ${response.status}`);
  }
  const data: DictData = await response.json();
  return data as unknown as Record<string, string>;
}

async function refreshExternalDictionaryInBackground(): Promise<DictLoadStatus> {
  if (zhRefreshPromise) return zhRefreshPromise;
  zhRefreshPromise = (async () => {
    try {
      const dict = await fetchExternalDictionaryFromNetwork();
      applyExternalDict(dict);
      saveToCache(externalDict);
      loadError = null;
      return 'loaded' as DictLoadStatus;
    } catch (error) {
      console.warn('Background dictionary refresh failed:', error);
      if (loadStatus !== 'loaded') {
        loadError = error instanceof Error ? error.message : 'Unknown error';
        loadStatus = 'failed';
        return 'failed' as DictLoadStatus;
      }
      return 'loaded' as DictLoadStatus;
    } finally {
      zhRefreshPromise = null;
    }
  })();
  return zhRefreshPromise;
}

async function refreshExternalDictionaryEnInBackground(): Promise<DictLoadStatus> {
  if (enRefreshPromise) return enRefreshPromise;
  enRefreshPromise = (async () => {
    try {
      const dict = await fetchExternalDictionaryEnFromNetwork();
      applyExternalDictEn(dict);
      saveEnToCache(externalDictEn);
      return 'loaded' as DictLoadStatus;
    } catch (error) {
      console.warn('Background English dictionary refresh failed:', error);
      if (loadStatusEn !== 'loaded') {
        loadStatusEn = 'failed';
        return 'failed' as DictLoadStatus;
      }
      return 'loaded' as DictLoadStatus;
    } finally {
      enRefreshPromise = null;
    }
  })();
  return enRefreshPromise;
}

/**
 * Load external dictionary: cache first, then background network refresh.
 */
export async function loadExternalDictionary(): Promise<DictLoadStatus> {
  const hadCache = hydrateExternalDictionaryFromCache();
  if (hadCache) {
    void refreshExternalDictionaryInBackground();
    return 'loaded';
  }

  if (loadStatus === 'loading' && zhRefreshPromise) {
    return zhRefreshPromise;
  }

  loadStatus = 'loading';
  loadError = null;
  return refreshExternalDictionaryInBackground();
}

/**
 * 启动时初始化中英外部词典：先用缓存，再后台更新。
 */
export async function initializeExternalDictionaries(): Promise<{
  zh: DictLoadStatus;
  en: DictLoadStatus;
}> {
  hydrateExternalDictionaryFromCache();
  hydrateExternalDictionaryEnFromCache();

  const [zh, en] = await Promise.all([
    loadExternalDictionary(),
    loadExternalDictionaryEn(),
  ]);
  return { zh, en };
}

/**
 * Clear old cache and reload dictionary
 */
export async function forceReloadDictionary(): Promise<DictLoadStatus> {
  resetDictState();
  clearCache();
  zhRefreshPromise = null;
  return loadExternalDictionary();
}

/**
 * Get the current load status
 */
export function getDictLoadStatus(): DictLoadStatus {
  return loadStatus;
}

/**
 * Get load error message
 */
export function getDictLoadError(): string | null {
  return loadError;
}

/**
 * 保守的屈折变体生成 - 只处理英语动词/名词的"变形"形式，
 * 不再做派生形态学（er/est/ly/ness/ment/...）和前缀剥离，
 * 避免出现 pier→pie、unaging→age、indiscernibly→discern 之类错误匹配。
 */
function getStemVariantsExternal(word: string): string[] {
	const variants: string[] = [];
	const lower = word.toLowerCase();
	const doubleConsonants = ['b', 'd', 'g', 'l', 'm', 'n', 'p', 'r', 's', 't'];

	if (lower.endsWith('ies') && lower.length > 4) {
		variants.push(lower.slice(0, -3) + 'y');
	}
	if (lower.endsWith('es') && lower.length > 3) {
		variants.push(lower.slice(0, -2));
		variants.push(lower.slice(0, -1));
	}
	if (lower.endsWith('s') && !lower.endsWith('ss') && lower.length > 2) {
		variants.push(lower.slice(0, -1));
	}
	if (lower.endsWith('ied') && lower.length > 4) {
		variants.push(lower.slice(0, -3) + 'y');
	}
	if (lower.endsWith('ed') && lower.length > 3) {
		variants.push(lower.slice(0, -2));
		variants.push(lower.slice(0, -1));
		const tail = lower.slice(0, -2);
		if (tail.length >= 2) {
			const a = tail[tail.length - 1];
			const b = tail[tail.length - 2];
			if (a === b && doubleConsonants.includes(a)) {
				variants.push(tail.slice(0, -1));
			}
		}
	}
	if (lower.endsWith('ing') && lower.length > 4) {
		const base = lower.slice(0, -3);
		variants.push(base);
		variants.push(base + 'e');
		if (base.length >= 2) {
			const a = base[base.length - 1];
			const b = base[base.length - 2];
			if (a === b && doubleConsonants.includes(a)) {
				variants.push(base.slice(0, -1));
			}
		}
	}

	const unique = [...new Set(variants)];
	return unique.filter(v => v.length >= 2 && v !== lower);
}

/**
 * 外部词典查找 - 仅做安全的屈折还原，不再做前缀剥离
 */
export function smartLookupExternal(word: string): string | null {
	const lower = word.toLowerCase().trim();

	if (externalDict[lower]) {
		return externalDict[lower];
	}

	const variants = getStemVariantsExternal(lower);
	for (const variant of variants) {
		if (externalDict[variant]) {
			return externalDict[variant];
		}
	}

	return null;
}

/**
 * Look up a word in the external dictionary
 */
export function lookupExternalDict(word: string): string | null {
	return smartLookupExternal(word);
}

/**
 * Check if external dictionary has a word (with smart suffix stripping)
 */
export function hasInExternalDict(word: string): boolean {
	return smartLookupExternal(word) !== null;
}

/**
 * Get total entries count in external dictionary
 */
export function getExternalDictSize(): number {
  return Object.keys(externalDict).length;
}

/**
 * Reset dictionary state (useful for testing)
 */
export function resetDictState(): void {
  externalDict = {};
  loadStatus = 'idle';
  loadError = null;
}

// Cache management functions
function loadFromCache(): Record<string, string> | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    const cachedVersion = localStorage.getItem(CACHE_VERSION_KEY);
    
    if (!cached || !cachedVersion) return null;
    
    // Check if cache is expired
    const expiryTime = parseInt(cachedVersion.split('_')[1] || '0', 10);
    if (Date.now() > expiryTime + CACHE_EXPIRY_MS) {
      clearCache();
      return null;
    }
    
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

function saveToCache(dict: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(dict));
    localStorage.setItem(CACHE_VERSION_KEY, `v1_${Date.now()}`);
  } catch (error) {
    console.warn('Failed to cache dictionary:', error);
  }
}

function clearCache(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_VERSION_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Force reload external dictionary
 */
export async function reloadExternalDictionary(): Promise<DictLoadStatus> {
  resetDictState();
  clearCache();
  zhRefreshPromise = null;
  return loadExternalDictionary();
}

// ==================== English-English Dictionary ====================

function loadEnFromCache(): Record<string, string> | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(CACHE_KEY_EN);
    const cachedVersion = localStorage.getItem(CACHE_VERSION_KEY_EN);
    if (!cached || !cachedVersion) return null;
    const expiryTime = parseInt(cachedVersion.split('_')[1] || '0', 10);
    if (Date.now() > expiryTime + CACHE_EXPIRY_MS) {
      localStorage.removeItem(CACHE_KEY_EN);
      localStorage.removeItem(CACHE_VERSION_KEY_EN);
      return null;
    }
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

function saveEnToCache(dict: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY_EN, JSON.stringify(dict));
    localStorage.setItem(CACHE_VERSION_KEY_EN, `v1_${Date.now()}`);
  } catch (error) {
    console.warn('Failed to cache English dictionary:', error);
  }
}

/**
 * Load external English-English dictionary from server or cache
 */
export async function loadExternalDictionaryEn(): Promise<DictLoadStatus> {
  const hadCache = hydrateExternalDictionaryEnFromCache();
  if (hadCache) {
    void refreshExternalDictionaryEnInBackground();
    return 'loaded';
  }

  if (loadStatusEn === 'loading' && enRefreshPromise) {
    return enRefreshPromise;
  }

  loadStatusEn = 'loading';
  return refreshExternalDictionaryEnInBackground();
}

/**
 * Look up a word in the external English-English dictionary
 */
export function lookupExternalDictEn(word: string): string | null {
  const lower = word.toLowerCase().trim();
  
  // Direct lookup
  if (externalDictEn[lower]) {
    return externalDictEn[lower];
  }
  
  const variants = getStemVariantsExternal(lower);
  for (const variant of variants) {
    if (externalDictEn[variant]) {
      return externalDictEn[variant];
    }
  }

  return null;
}

/**
 * Get English-English dictionary size
 */
export function getExternalDictEnSize(): number {
  return Object.keys(externalDictEn).length;
}
