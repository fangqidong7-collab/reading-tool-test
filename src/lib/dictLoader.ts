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
    const response = await fetch('/dict.json', {
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
 * 智能去后缀 - 尝试多种可能的还原形式（外部词典用）
 */
function getStemVariantsExternal(word: string): string[] {
	const variants: string[] = [];
	const lower = word.toLowerCase();
	
	const doubleConsonants = ['b', 'd', 'g', 'm', 'n', 'p', 'r', 's', 't'];
	const vowelEnding = /[aeiou]$/;
	const consonantYEnding = /[bcdfghjklmnpqrstvwxyz]y$/i;
	
	// ================== 后缀处理 ==================
	
	// 去-ness时
	if (lower.endsWith('ness')) {
		const base = lower.slice(0, -4);
		variants.push(base);
		// happiness -> happy, laziness -> lazy
		if (lower.endsWith('iness')) {
			variants.push(base + 'y');
		}
		// kindness -> kind
	}
	
	// 去-ment时
	if (lower.endsWith('ment')) {
		const base = lower.slice(0, -4);
		variants.push(base);
		// excitement -> excite
		if (base.endsWith('e')) {
			variants.push(base);
		} else {
			variants.push(base + 'e');
		}
	}
	
	// 去-tion时
	if (lower.endsWith('tion')) {
		const base = lower.slice(0, -4);
		variants.push(base);
		variants.push(base + 'e');
		// education -> educate
		if (!base.endsWith('e')) {
			variants.push(base + 'e');
		}
	}
	
	// 去-able时
	if (lower.endsWith('able')) {
		const base = lower.slice(0, -4);
		variants.push(base);
		// comfortable -> comfort
		if (!base.endsWith('e')) {
			variants.push(base + 'e');
		}
	}
	
	// 去-ible时
	if (lower.endsWith('ible')) {
		const base = lower.slice(0, -4);
		variants.push(base);
	}
	
	// 去-ful时
	if (lower.endsWith('ful')) {
		const base = lower.slice(0, -3);
		variants.push(base);
		// careful -> care
		if (base.endsWith(' ')) {
			// shouldn't happen
		}
		// beautiful -> beauty (特殊处理)
		if (lower.endsWith('iful') || lower.endsWith('tiful')) {
			const base2 = base.slice(0, -1); // beauti
			variants.push(base2 + 'y'); // beauty
		}
	}
	
	// 去-ous时
	if (lower.endsWith('ous')) {
		const base = lower.slice(0, -3);
		variants.push(base);
		// dangerous -> danger
	}
	
	// 去-ive时
	if (lower.endsWith('ive')) {
		const base = lower.slice(0, -3);
		variants.push(base);
		// active -> act
		variants.push(base + 'e');
		// creative -> create
		if (!base.endsWith('e')) {
			variants.push(base + 'e');
		}
	}
	
	// 去-al时
	if (lower.endsWith('al')) {
		const base = lower.slice(0, -2);
		variants.push(base);
		// national -> nation
		variants.push(base + 'ity');
		// personal -> person
		if (base.endsWith('al')) {
			variants.push(base.slice(0, -2));
		}
	}
	
	// 去-en时
	if (lower.endsWith('en')) {
		const base = lower.slice(0, -2);
		variants.push(base);
		// wooden -> wood
	}
	
	// 去-ed时
	if (lower.endsWith('ed')) {
		const base = lower.slice(0, -2);
		variants.push(base);
		variants.push(base + 'e');
		variants.push(lower.slice(0, -1));
		if (base.length >= 2) {
			const lastTwo = base.slice(-2);
			if (lastTwo[0] === lastTwo[1] && doubleConsonants.includes(lastTwo[0])) {
				variants.push(base.slice(0, -1));
			}
		}
		if (consonantYEnding.test(base)) {
			variants.push(base.slice(0, -1) + 'ied');
		}
	}
	
	// 去-ing时
	if (lower.endsWith('ing')) {
		const base = lower.slice(0, -3);
		variants.push(base);
		if (vowelEnding.test(base.slice(-2, -1))) {
			variants.push(base + 'e');
		}
		if (base.length >= 2) {
			const lastTwo = base.slice(-2);
			if (lastTwo[0] === lastTwo[1] && doubleConsonants.includes(lastTwo[0])) {
				variants.push(base.slice(0, -1));
			}
		}
	}
	
	// 去-s时
	if (lower.endsWith('s') && lower.length > 2) {
		const base = lower.slice(0, -1);
		if (lower.endsWith('es')) {
			const baseEs = lower.slice(0, -2);
			variants.push(baseEs);
			if (/[shxz]/.test(baseEs.slice(-1)) || baseEs.endsWith('ch') || baseEs.endsWith('o')) {
				variants.push(baseEs);
			}
			if (consonantYEnding.test(baseEs)) {
				variants.push(baseEs.slice(0, -1) + 'ied');
			}
		}
		variants.push(base);
		if (consonantYEnding.test(base)) {
			variants.push(base.slice(0, -1) + 'ies');
		}
	}
	
	// 去-er时
	if (lower.endsWith('er')) {
		const base = lower.slice(0, -2);
		variants.push(base);
		variants.push(base + 'e');
		if (base.length >= 2) {
			const lastTwo = base.slice(-2);
			if (lastTwo[0] === lastTwo[1] && doubleConsonants.includes(lastTwo[0])) {
				variants.push(base.slice(0, -1));
			}
		}
	}
	
	// 去-est时
	if (lower.endsWith('est')) {
		const base = lower.slice(0, -3);
		variants.push(base);
		variants.push(base + 'e');
		if (base.length >= 2) {
			const lastTwo = base.slice(-2);
			if (lastTwo[0] === lastTwo[1] && doubleConsonants.includes(lastTwo[0])) {
				variants.push(base.slice(0, -1));
			}
		}
	}
	
	// 去-ly时
	if (lower.endsWith('ly')) {
		const base = lower.slice(0, -2);
		variants.push(base);
		variants.push(base + 'le');
		variants.push(base + 'y');
		if (lower.endsWith('ally')) {
			variants.push(lower.slice(0, -4));
		}
	}
	
	// ================== 前缀处理 ==================
	
	// 去常见前缀
	const prefixes = ['un', 're', 'dis', 'mis', 'pre', 'over', 'im', 'in', 'ir', 'il'];
	
	for (const prefix of prefixes) {
		if (lower.startsWith(prefix) && lower.length > prefix.length + 2) {
			const withoutPrefix = lower.slice(prefix.length);
			variants.push(withoutPrefix);
			
			// 对去前缀后的词也尝试后缀处理
			const subVariants = getStemVariantsExternal(withoutPrefix);
			for (const sv of subVariants) {
				variants.push(sv);
			}
		}
	}
	
	// 递归尝试更短的词根
	if (variants.length > 0) {
		const uniqueVariants = [...new Set(variants)];
		for (const v of uniqueVariants) {
			if (v !== lower && v.length > 2) {
				const recursive = getStemVariantsExternal(v);
				for (const r of recursive) {
					if (!variants.includes(r)) {
						variants.push(r);
					}
				}
			}
		}
	}
	
	const unique = [...new Set(variants)];
	return unique.filter(v => v.length >= 2 && v !== lower);
}

/**
 * 智能词典查找 - 支持后缀智能去除
 */
export function smartLookupExternal(word: string): string | null {
	const lower = word.toLowerCase().trim();
	
	// 1. 先查原始单词
	if (externalDict[lower]) {
		return externalDict[lower];
	}
	
	// 2. 获取所有可能的词根变体并尝试
	const variants = getStemVariantsExternal(lower);
	for (const variant of variants) {
		if (externalDict[variant]) {
			return externalDict[variant];
		}
	}
	
	// 3. 去前缀处理
	const prefixVariants = getPrefixVariants(lower);
	for (const variant of prefixVariants) {
		if (externalDict[variant]) {
			return externalDict[variant];
		}
	}
	
	// Debug: log words not found
	// console.log('词典未找到:', word, '尝试过的候选词:', [...new Set([lower, ...variants, ...prefixVariants])]);
	
	return null;
}

/**
 * 获取去掉前缀后的变体
 */
function getPrefixVariants(word: string): string[] {
	const variants: string[] = [];
	const lower = word.toLowerCase();
	
	// 常见前缀
	const prefixes = ['un', 're', 'dis', 'mis', 'pre', 'over', 'im', 'in', 'ir', 'il'];
	
	for (const prefix of prefixes) {
		if (lower.startsWith(prefix) && lower.length > prefix.length + 2) {
			const withoutPrefix = lower.slice(prefix.length);
			variants.push(withoutPrefix);
		}
	}
	
	return [...new Set(variants)];
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
