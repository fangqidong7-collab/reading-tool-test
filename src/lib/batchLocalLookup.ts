import { lemmatize } from '@/lib/dictionary';
import { lookupLocalMeaning, type DictLookupMode } from '@/lib/wordLookup';
import { shortenTranslation } from '@/lib/annotationText';
import { isTranslationError } from '@/lib/translate';

export interface LocalLookupResult {
  meaning: string;
  meaningZh?: string;
  meaningEn?: string;
  meaningEnSimple?: string;
}

/** 批量本地查词：lemma 优先，返回命中释义；未命中返回 null */
export function batchLocalLookup(
  words: string[],
  dictMode: DictLookupMode,
): Map<string, LocalLookupResult> {
  const hits = new Map<string, LocalLookupResult>();
  const isEn = dictMode === 'en' || dictMode === 'en-simple';

  for (const word of words) {
    const root = lemmatize(word.toLowerCase());
    const zhRaw = lookupLocalMeaning(root, word, 'zh');
    const enRaw = lookupLocalMeaning(root, word, 'en');
    const primary = isEn ? enRaw : zhRaw;
    if (!primary || isTranslationError(primary)) continue;

    hits.set(word, {
      meaning: shortenTranslation(primary, dictMode),
      meaningZh: zhRaw && !isTranslationError(zhRaw) ? shortenTranslation(zhRaw, 'zh') : undefined,
      meaningEn: enRaw && !isTranslationError(enRaw) ? shortenTranslation(enRaw, 'en') : undefined,
      meaningEnSimple: enRaw && !isTranslationError(enRaw) ? shortenTranslation(enRaw, 'en-simple') : undefined,
    });
  }

  return hits;
}

/** 批量本地查词，任一语言命中即返回（用于多语言释义填充） */
export function batchLocalLookupAll(words: string[]): Map<string, LocalLookupResult> {
  const hits = new Map<string, LocalLookupResult>();

  for (const word of words) {
    const root = lemmatize(word.toLowerCase());
    const zhRaw = lookupLocalMeaning(root, word, 'zh');
    const enRaw = lookupLocalMeaning(root, word, 'en');
    const hasZh = Boolean(zhRaw && !isTranslationError(zhRaw));
    const hasEn = Boolean(enRaw && !isTranslationError(enRaw));
    if (!hasZh && !hasEn) continue;

    const meaningZh = hasZh ? shortenTranslation(zhRaw, 'zh') : undefined;
    const meaningEn = hasEn ? shortenTranslation(enRaw, 'en') : undefined;
    const primary = meaningZh || meaningEn || '';

    hits.set(word, {
      meaning: primary,
      meaningZh,
      meaningEn,
      meaningEnSimple: hasEn ? shortenTranslation(enRaw, 'en-simple') : undefined,
    });
  }

  return hits;
}
