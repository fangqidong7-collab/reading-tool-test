export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

const LEVEL_ORDER: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const LEVEL_COLORS: Record<CEFRLevel, string> = {
  A1: '#22c55e',
  A2: '#15803d',
  B1: '#3b82f6',
  B2: '#f59e0b',
  C1: '#a855f7',
  C2: '#6d28d9',
};

export const LEVEL_LABELS: Record<CEFRLevel, string> = {
  A1: 'A1 基础',
  A2: 'A2 初级',
  B1: 'B1 中级',
  B2: 'B2 中高级',
  C1: 'C1 高级',
  C2: 'C2 精通',
};

let vocabData: Record<string, CEFRLevel> | null = null;
let loading = false;

export async function loadVocabLevels(): Promise<void> {
  if (vocabData || loading) return;
  loading = true;
  try {
    const res = await fetch('/vocab-levels.json');
    if (res.ok) {
      vocabData = await res.json();
      try {
        const { registerKnownWords } = await import('@/lib/dictionary');
        registerKnownWords(Object.keys(vocabData!));
      } catch (_) { /* dictionary module not available */ }
    }
  } catch (e) {
    console.warn('[VocabLevel] failed to load:', e);
  }
  loading = false;
}

export function getWordLevel(word: string): CEFRLevel | null {
  if (!vocabData) return null;
  return vocabData[word.toLowerCase().trim()] || null;
}

export function isLoaded(): boolean {
  return vocabData !== null;
}

export function levelIndex(level: CEFRLevel): number {
  return LEVEL_ORDER.indexOf(level);
}

export function isAtOrAbove(wordLevel: CEFRLevel, threshold: CEFRLevel): boolean {
  return levelIndex(wordLevel) >= levelIndex(threshold);
}

export function getLevelColor(level: CEFRLevel): string {
  return LEVEL_COLORS[level];
}
