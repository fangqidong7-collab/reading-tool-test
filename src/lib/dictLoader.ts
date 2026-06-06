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

/**
 * Load external dictionary from server or cache
 * Always fetches from server to check for updates
 */
export async function loadExternalDictionary(): Promise<DictLoadStatus> {
  if (loadStatus === 'loaded' || loadStatus === 'loading') {
    return loadStatus;
  }

  loadStatus = 'loading';
  loadError = null;

  try {
    // Always fetch from server to check if dict.json has been updated
    const fetchUrl = typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
      ? `${window.location.protocol}//${window.location.host}/dict.json` 
      : '/dict.json';
    const response = await fetch(fetchUrl, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to load dictionary: ${response.status}`);
    }

    const data: DictData = await response.json();
    
    // Handle new simple format (word -> meaning string)
    // or legacy format (entries: { word -> { meaning, pos } })
    if ('entries' in data && data.entries) {
      // Legacy format
      const entries = data.entries;
      externalDict = {};
      for (const [word, entry] of Object.entries(entries)) {
        externalDict[word] = typeof entry === 'string' ? entry : (entry as DictEntry).meaning;
      }
    } else {
      // New simple format
      externalDict = data as unknown as Record<string, string>;
    }
    
    
    // Save to cache (this will overwrite any old cache)
    saveToCache(externalDict);

    try {
      const { registerKnownWords } = await import('@/lib/dictionary');
      registerKnownWords(Object.keys(externalDict));
    } catch (_) { /* dictionary module not available */ }

    loadStatus = 'loaded';
    return 'loaded';
  } catch (error) {
    console.error('Failed to load external dictionary:', error);
    loadError = error instanceof Error ? error.message : 'Unknown error';
    
    // If we have cache, use it even if fetch fails
    const cached = loadFromCache();
    if (cached) {
      externalDict = cached;
      loadStatus = 'loaded';
      return 'loaded';
    }
    
    loadStatus = 'failed';
    return 'failed';
  }
}

/**
 * Clear old cache and reload dictionary
 */
export async function forceReloadDictionary(): Promise<DictLoadStatus> {
  resetDictState();
  clearCache();
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
  return loadExternalDictionary();
}

// ==================== English-English Dictionary ====================

/**
 * Load external English-English dictionary from server or cache
 */
export async function loadExternalDictionaryEn(): Promise<DictLoadStatus> {
  if (loadStatusEn === 'loaded' || loadStatusEn === 'loading') {
    return loadStatusEn;
  }

  loadStatusEn = 'loading';

  try {
    // Load from server
    const fetchUrl = typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
      ? `${window.location.protocol}//${window.location.host}/dict_en.json` 
      : '/dict_en.json';
    
    const response = await fetch(fetchUrl, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to load English dictionary: ${response.status}`);
    }

    const data: DictData = await response.json();
    externalDictEn = data as unknown as Record<string, string>;
    
    
    // Save to cache
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(CACHE_KEY_EN, JSON.stringify(externalDictEn));
      } catch (error) {
        console.warn('Failed to cache English dictionary:', error);
      }
    }
    
    loadStatusEn = 'loaded';
    return 'loaded';
  } catch (error) {
    console.error('Failed to load English dictionary:', error);
    
    // Try to load from cache
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(CACHE_KEY_EN);
        if (cached) {
          externalDictEn = JSON.parse(cached);
          loadStatusEn = 'loaded';
          return 'loaded';
        }
      } catch {
        // Ignore cache errors
      }
    }
    
    loadStatusEn = 'failed';
    return 'failed';
  }
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
