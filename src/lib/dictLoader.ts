// Dictionary Loader - External Dictionary Loading and Caching

export interface DictEntry {
  meaning: string;
  pos: string;
}

export interface DictData {
  version: string;
  description: string;
  entries: Record<string, DictEntry>;
}

export type DictLoadStatus = 'idle' | 'loading' | 'loaded' | 'failed';

// Global state for external dictionary
let externalDict: Record<string, DictEntry> = {};
let loadStatus: DictLoadStatus = 'idle';
let loadError: string | null = null;

// Cache key for localStorage
const CACHE_KEY = 'reading_assistant_ext_dict';
const CACHE_VERSION_KEY = 'reading_assistant_dict_version';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Load external dictionary from server or cache
 */
export async function loadExternalDictionary(): Promise<DictLoadStatus> {
  if (loadStatus === 'loaded' || loadStatus === 'loading') {
    return loadStatus;
  }

  loadStatus = 'loading';
  loadError = null;

  try {
    // Try to load from cache first
    const cached = loadFromCache();
    if (cached) {
      externalDict = cached;
      loadStatus = 'loaded';
      return 'loaded';
    }

    // Load from server
    const response = await fetch('/dict.json');
    if (!response.ok) {
      throw new Error(`Failed to load dictionary: ${response.status}`);
    }

    const data: DictData = await response.json();
    externalDict = data.entries || {};
    
    // Save to cache
    saveToCache(externalDict);
    
    loadStatus = 'loaded';
    return 'loaded';
  } catch (error) {
    console.error('Failed to load external dictionary:', error);
    loadError = error instanceof Error ? error.message : 'Unknown error';
    loadStatus = 'failed';
    return 'failed';
  }
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
 * Look up a word in the external dictionary
 */
export function lookupExternalDict(word: string): DictEntry | null {
  const lowerWord = word.toLowerCase().trim();
  return externalDict[lowerWord] || null;
}

/**
 * Check if external dictionary has a word
 */
export function hasInExternalDict(word: string): boolean {
  const lowerWord = word.toLowerCase().trim();
  return lowerWord in externalDict;
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
function loadFromCache(): Record<string, DictEntry> | null {
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

function saveToCache(dict: Record<string, DictEntry>): void {
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
