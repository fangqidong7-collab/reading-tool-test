import { getWordMeaning, getWordMeaningEn } from '@/lib/dictionary';
import { lookupExternalDict, lookupExternalDictEn } from '@/lib/dictLoader';
import { recordLookupTiming } from '@/lib/lookupTiming';

export type DictLookupMode = 'zh' | 'en' | 'en-simple';

function lookupKeys(root: string, surfaceWord: string): string[] {
  const clean = surfaceWord.toLowerCase().trim();
  const lemma = root.trim().toLowerCase();
  return [...new Set([lemma, clean].filter(Boolean))];
}

/**
 * 本地词典查找：优先 lemma(root)，再 fallback 词面形式。
 */
export function lookupBuiltinMeaning(
  root: string,
  surfaceWord: string,
  dictMode: DictLookupMode,
): string {
  const start = typeof performance !== 'undefined' ? performance.now() : 0;
  const isEnglishMode = dictMode === 'en' || dictMode === 'en-simple';
  for (const key of lookupKeys(root, surfaceWord)) {
    if (isEnglishMode) {
      const en = getWordMeaningEn(key);
      if (en) {
        if (typeof performance !== 'undefined') {
          recordLookupTiming('dict-builtin', performance.now() - start);
        }
        return en;
      }
    } else {
      const zh = getWordMeaning(key);
      if (zh?.meaning) {
        if (typeof performance !== 'undefined') {
          recordLookupTiming('dict-builtin', performance.now() - start);
        }
        return zh.meaning;
      }
    }
  }
  return '';
}

export function lookupExternalMeaning(
  root: string,
  surfaceWord: string,
  dictMode: DictLookupMode,
): string {
  const start = typeof performance !== 'undefined' ? performance.now() : 0;
  const isEnglishMode = dictMode === 'en' || dictMode === 'en-simple';
  for (const key of lookupKeys(root, surfaceWord)) {
    const ext = isEnglishMode ? lookupExternalDictEn(key) : lookupExternalDict(key);
    if (ext) {
      if (typeof performance !== 'undefined') {
        recordLookupTiming('dict-external', performance.now() - start);
      }
      return ext;
    }
  }
  return '';
}

export function lookupLocalMeaning(
  root: string,
  surfaceWord: string,
  dictMode: DictLookupMode,
): string {
  const builtin = lookupBuiltinMeaning(root, surfaceWord, dictMode);
  if (builtin) return builtin;
  return lookupExternalMeaning(root, surfaceWord, dictMode);
}
