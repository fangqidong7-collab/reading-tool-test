// Dictionary Loader - External Dictionary Loading and Caching

export interface DictEntry {
  meaning: string;
  pos?: string;
}

export interface DictData {
  [word: string]: string;
}

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

const CACHE_KEY = 'reading_assistant_ext_dict';
const CACHE_VERSION_KEY = 'reading_assistant_dict_version';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;

export async function loadExternalDictionary(): Promise<DictLoadStatus> {
  console.log('loadExternalDictionary 被调用, 当前状态:', { loadStatus, externalDictKeys: Object.keys(externalDict).length });
  
  if (loadStatus === 'loaded' || loadStatus === 'loading') {
    console.log('loadExternalDictionary 直接返回, 状态:', loadStatus);
    return loadStatus;
  }

  loadStatus = 'loading';
  loadError = null;

  try {
    console.log('开始从 /dict.json 加载外部词典...');
    const fetchUrl = typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
      ? `${window.location.protocol}//${window.location.host}/dict.json` 
      : '/dict.json';
    console.log('fetch URL:', fetchUrl);
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
    console.log('dict.json 加载成功, fetch URL:', fetchUrl);
    console.log('响应状态:', response.status);
    console.log('数据键数量:', Object.keys(data).length);
    
    if ('entries' in data && data.entries) {
      const entries = data.entries;
      externalDict = {};
      for (const [word, entry] of Object.entries(entries)) {
        externalDict[word] = typeof entry === 'string' ? entry : (entry as DictEntry).meaning;
      }
    } else {
      externalDict = data as unknown as Record<string, string>;
    }
    
    console.log('externalDict 初始化完成, 词条数:', Object.keys(externalDict).length);
    
    saveToCache(externalDict);
    
    loadStatus = 'loaded';
    console.log('loadStatus 设置为 loaded');
    return 'loaded';
  } catch (error) {
    console.error('Failed to load external dictionary:', error);
    loadError = error instanceof Error ? error.message : 'Unknown error';
    
    const cached = loadFromCache();
    if (cached) {
      console.log('从缓存恢复 externalDict, 词条数:', Object.keys(cached).length);
      externalDict = cached;
      loadStatus = 'loaded';
      return 'loaded';
    }
    
    loadStatus = 'failed';
    return 'failed';
  }
}

export async function forceReloadDictionary(): Promise<DictLoadStatus> {
  resetDictState();
  clearCache();
  return loadExternalDictionary();
}

export function getDictLoadStatus(): DictLoadStatus {
  return loadStatus;
}

export function getDictLoadError(): string | null {
  return loadError;
}

function getStemVariantsExternal(word: string): string[] {
	const variants: string[] = [];
	const lower = word.toLowerCase();
	
	const doubleConsonants = ['b', 'd', 'g', 'm', 'n', 'p', 'r', 's', 't'];
	const vowelEnding = /[aeiou]$/;
	const consonantYEnding = /[bcdfghjklmnpqrstvwxyz]y$/i;
	
	if (lower.endsWith('ness')) {
		const base = lower.slice(0, -4);
		variants.push(base);
		if (lower.endsWith('iness')) {
			variants.push(base + 'y');
		}
	}
	
	if (lower.endsWith('ment')) {
		const base = lower.slice(0, -4);
		variants.push(base);
		if (base.endsWith('e')) {
			variants.push(base);
		} else {
			variants.push(base + 'e');
		}
	}
	
	if (lower.endsWith('tion')) {
		const base = lower.slice(0, -4);
		variants.push(base);
		variants.push(base + 'e');
		if (!base.endsWith('e')) {
			variants.push(base + 'e');
		}
	}
	
	if (lower.endsWith('able')) {
		const base = lower.slice(0, -4);
		variants.push(base);
		if (!base.endsWith('e')) {
			variants.push(base + 'e');
		}
	}
	
	if (lower.endsWith('ible')) {
		const base = lower.slice(0, -4);
		variants.push(base);
	}
	
	if (lower.endsWith('ful')) {
		const base = lower.slice(0, -3);
		variants.push(base);
		if (lower.endsWith('iful') || lower.endsWith('tiful')) {
			const base2 = base.slice(0, -1);
			variants.push(base2 + 'y');
		}
	}
	
	if (lower.endsWith('ous')) {
		const base = lower.slice(0, -3);
		variants.push(base);
	}
	
	if (lower.endsWith('ive')) {
		const base = lower.slice(0, -3);
		variants.push(base);
		variants.push(base + 'e');
		if (!base.endsWith('e')) {
			variants.push(base + 'e');
		}
	}
	
	if (lower.endsWith('al')) {
		const base = lower.slice(0, -2);
		variants.push(base);
		variants.push(base + 'ity');
		if (base.endsWith('al')) {
			variants.push(base.slice(0, -2));
		}
	}
	
	if (lower.endsWith('en')) {
		const base = lower.slice(0, -2);
		variants.push(base);
	}
	
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
	
	if (lower.endsWith('ly')) {
		const base = lower.slice(0, -2);
		variants.push(base);
		variants.push(base + 'le');
		variants.push(base + 'y');
		if (lower.endsWith('ally')) {
			variants.push(lower.slice(0, -4));
		}
	}
	
	const prefixes = ['un', 're', 'dis', 'mis', 'pre', 'over', 'im', 'in', 'ir', 'il'];
	
	for (const prefix of prefixes) {
		if (lower.startsWith(prefix) && lower.length > prefix.length + 2) {
			const withoutPrefix = lower.slice(prefix.length);
			variants.push(withoutPrefix);
			const subVariants = getStemVariantsExternal(withoutPrefix);
			for (const sv of subVariants) {
				variants.push(sv);
			}
		}
	}
	
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
	
	const prefixVariants = getPrefixVariants(lower);
	for (const variant of prefixVariants) {
		if (externalDict[variant]) {
			return externalDict[variant];
		}
	}
	
	return null;
}

function getPrefixVariants(word: string): string[] {
	const variants: string[] = [];
	const lower = word.toLowerCase();
	
	const prefixes = ['un', 're', 'dis', 'mis', 'pre', 'over', 'im', 'in', 'ir', 'il'];
	
	for (const prefix of prefixes) {
		if (lower.startsWith(prefix) && lower.length > prefix.length + 2) {
			const withoutPrefix = lower.slice(prefix.length);
			variants.push(withoutPrefix);
		}
	}
	
	return [...new Set(variants)];
}

export function lookupExternalDict(word: string): string | null {
	return smartLookupExternal(word);
}

export function hasInExternalDict(word: string): boolean {
	return smartLookupExternal(word) !== null;
}

export function getExternalDictSize(): number {
  return Object.keys(externalDict).length;
}

export function resetDictState(): void {
  externalDict = {};
  loadStatus = 'idle';
  loadError = null;
}

function loadFromCache(): Record<string, string> | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    const cachedVersion = localStorage.getItem(CACHE_VERSION_KEY);
    
    if (!cached || !cachedVersion) return null;
    
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

export async function reloadExternalDictionary(): Promise<DictLoadStatus> {
  resetDictState();
  clearCache();
  return loadExternalDictionary();
}

// ========== 英英外部词典加载 (dict_en.json) ==========
let externalDictEn: Record<string, string> = {};
let loadStatusEn: DictLoadStatus = 'idle';
const CACHE_KEY_EN = 'reading_assistant_ext_dict_en';
const CACHE_VERSION_KEY_EN = 'reading_assistant_dict_en_version';

export async function loadExternalDictionaryEn(): Promise<DictLoadStatus> {
  if (loadStatusEn === 'loaded' || loadStatusEn === 'loading') {
    return loadStatusEn;
  }
  loadStatusEn = 'loading';
  try {
    const fetchUrl = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
      ? `${window.location.protocol}//${window.location.host}/dict_en.json`
      : '/dict_en.json';
    const response = await fetch(fetchUrl, { headers: { 'Cache-Control': 'no-cache' } });
    if (!response.ok) throw new Error(`Failed to load EN dict: ${response.status}`);
    const data = await response.json();
    externalDictEn = data as Record<string, string>;
    console.log('dict_en.json loaded, entries:', Object.keys(externalDictEn).length);
    try {
      localStorage.setItem(CACHE_KEY_EN, JSON.stringify(externalDictEn));
      localStorage.setItem(CACHE_VERSION_KEY_EN, `v1_${Date.now()}`);
    } catch (e) { console.warn('Cache EN dict failed:', e); }
    loadStatusEn = 'loaded';
    return 'loaded';
  } catch (error) {
    console.error('Load EN dict failed:', error);
    try {
      const cached = localStorage.getItem(CACHE_KEY_EN);
      if (cached) {
        externalDictEn = JSON.parse(cached);
        loadStatusEn = 'loaded';
        return 'loaded';
      }
    } catch (e) { /* ignore */ }
    loadStatusEn = 'failed';
    return 'failed';
  }
}

function smartLookupExternalEn(word: string): string | null {
  const lower = word.toLowerCase().trim();
  if (externalDictEn[lower]) return externalDictEn[lower];
  const variants = getStemVariantsExternal(lower);
  for (const v of variants) {
    if (externalDictEn[v]) return externalDictEn[v];
  }
  const pv = getPrefixVariants(lower);
  for (const v of pv) {
    if (externalDictEn[v]) return externalDictEn[v];
  }
  return null;
}

export function lookupExternalDictEn(word: string): string | null {
  return smartLookupExternalEn(word);
}
