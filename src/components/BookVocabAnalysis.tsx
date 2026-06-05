"use client";

import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { X } from "lucide-react";
import type { ProcessedContent } from "@/hooks/useBookshelf";
import { getWordLevel, getLevelColors, LEVEL_LABELS, type CEFRLevel } from "@/lib/vocabLevel";
import type { CefrColorPaletteId } from "@/lib/cefrColorPalettes";
import { lemmatizeInflection } from "@/lib/dictionary";
import { translateWord, translateWordEn, translateWordEnSimple, isTranslationError } from "@/lib/translate";
import { shortenTranslation } from "@/lib/annotationText";
import { batchLocalLookup, batchLocalLookupAll } from "@/lib/batchLocalLookup";

interface BookVocabAnalysisProps {
  isOpen: boolean;
  onClose: () => void;
  processedContent: ProcessedContent | null;
  headerBg: string;
  headerTextColor: string;
  textColor: string;
  isDarkMode: boolean;
  backgroundColor: string;
  globalVocabulary?: Record<string, { root: string; meaning: string; pos: string }>;
  masteredWords?: Set<string>;
  onAddToVocabulary?: (word: string, meaning: string, pos: string, langs?: { zh?: string; en?: string; enSimple?: string }) => void;
  onBatchAddToVocabulary?: (entries: Record<string, { root: string; meaning: string; pos: string; meaningZh?: string; meaningEn?: string; meaningEnSimple?: string }>) => void;
  onMarkAsMastered?: (
    word: string,
    supplemental?: { meaning?: string; pos?: string; meaningZh?: string; meaningEn?: string; meaningEnSimple?: string },
  ) => void;
  onUnmarkMastered?: (word: string) => void;
  dictMode?: 'zh' | 'en' | 'en-simple';
  cefrColorPalette?: CefrColorPaletteId;
}

interface WordStat {
  word: string;
  count: number;
  level: CEFRLevel | null;
}

const ALL_LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const STOPWORDS = new Set([
  'i', 'a', 'an', 'the', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should',
  'may', 'might', 'must', 'can', 'could', 'to', 'of', 'in', 'for', 'on', 'with',
  'at', 'by', 'from', 'as', 'into', 'about', 'up', 'out', 'if', 'or', 'and', 'but',
  'not', 'no', 'so', 'we', 'he', 'she', 'it', 'they', 'me', 'him', 'her', 'us',
  'them', 'my', 'his', 'its', 'our', 'your', 'their', 'this', 'that', 'these',
  'those', 'what', 'which', 'who', 'whom', 'how', 'when', 'where', 'why',
  'all', 'each', 'both', 'than', 'too', 'very', 'just', 'also',
]);

function lookupMeaning(word: string, dictMode: 'zh' | 'en' | 'en-simple'): string {
  return batchLocalLookup([word], dictMode).get(word)?.meaning ?? '';
}

function lookupAllLocal(word: string): { zh?: string; en?: string; enSimple?: string } {
  const hit = batchLocalLookupAll([word]).get(word);
  if (!hit) return {};
  return {
    zh: hit.meaningZh,
    en: hit.meaningEn,
    enSimple: hit.meaningEnSimple,
  };
}

async function aiTranslate(word: string, dictMode: 'zh' | 'en' | 'en-simple'): Promise<string> {
  try {
    let raw: string;
    if (dictMode === 'en-simple') raw = await translateWordEnSimple(word);
    else if (dictMode === 'en') raw = await translateWordEn(word);
    else raw = await translateWord(word);
    return shortenTranslation(raw, dictMode);
  } catch {
    return '';
  }
}

export function BookVocabAnalysis({
  isOpen,
  onClose,
  processedContent,
  headerBg,
  headerTextColor,
  textColor,
  isDarkMode,
  backgroundColor,
  globalVocabulary,
  masteredWords,
  onAddToVocabulary,
  onBatchAddToVocabulary,
  onMarkAsMastered,
  onUnmarkMastered,
  dictMode = 'zh',
  cefrColorPalette = 'standard',
}: BookVocabAnalysisProps) {
  const levelColors = useMemo(
    () => getLevelColors(cefrColorPalette, isDarkMode),
    [cefrColorPalette, isDarkMode],
  );
  const [tab, setTab] = useState<'overview' | 'words'>('overview');
  const [filterLevels, setFilterLevels] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [vocabFilter, setVocabFilter] = useState<'all' | 'hide' | 'only'>('all');
  const [masteredFilter, setMasteredFilter] = useState<'all' | 'hide' | 'only'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [addedWords, setAddedWords] = useState<Set<string>>(new Set());
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [loadingWord, setLoadingWord] = useState<string | null>(null);
  const batchAbortRef = useRef(false);
  const [visibleCount, setVisibleCount] = useState(100);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const [minLen, setMinLen] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const saved = localStorage.getItem('va-min-word-len');
    return saved ? parseInt(saved, 10) || 0 : 0;
  });
  const handleMinLenChange = useCallback((val: number) => {
    const v = Math.max(0, Math.min(20, val));
    setMinLen(v);
    localStorage.setItem('va-min-word-len', String(v));
  }, []);

  const [minFreq, setMinFreq] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const saved = localStorage.getItem('va-min-word-freq');
    return saved ? parseInt(saved, 10) || 0 : 0;
  });
  const handleMinFreqChange = useCallback((val: number) => {
    const v = Math.max(0, Math.min(999, val));
    setMinFreq(v);
    localStorage.setItem('va-min-word-freq', String(v));
  }, []);

  const analysis = useMemo(() => {
    if (!processedContent) return null;

    const wordCounts = new Map<string, { count: number; original: string }>();
    let totalWords = 0;

    for (const para of processedContent) {
      for (const seg of para.segments) {
        if (seg.type !== 'word') continue;
        totalWords++;
        const root = seg.lemma || lemmatizeInflection(seg.text.toLowerCase());
        if (STOPWORDS.has(root) || root.length <= 1) continue;
        const existing = wordCounts.get(root);
        if (existing) {
          existing.count++;
        } else {
          wordCounts.set(root, { count: 1, original: seg.text });
        }
      }
    }

    const levelCounts: Record<string, number> = {};
    const levelUniqueWords: Record<string, number> = {};
    let unknownCount = 0;
    let unknownUniqueCount = 0;

    ALL_LEVELS.forEach(l => { levelCounts[l] = 0; levelUniqueWords[l] = 0; });

    const words: WordStat[] = [];
    for (const [root, data] of wordCounts) {
      const level = getWordLevel(root);
      words.push({ word: root, count: data.count, level });
      if (level) {
        levelCounts[level] = (levelCounts[level] || 0) + data.count;
        levelUniqueWords[level] = (levelUniqueWords[level] || 0) + 1;
      } else {
        unknownCount += data.count;
        unknownUniqueCount++;
      }
    }

    words.sort((a, b) => b.count - a.count);

    return {
      totalWords,
      uniqueWords: wordCounts.size,
      levelCounts,
      levelUniqueWords,
      unknownCount,
      unknownUniqueCount,
      words,
    };
  }, [processedContent]);

  const isInVocab = useCallback((word: string) => {
    return !!(globalVocabulary && globalVocabulary[word]) || addedWords.has(word);
  }, [globalVocabulary, addedWords]);

  const isMastered = useCallback((word: string) => {
    return !!(masteredWords && masteredWords.has(word));
  }, [masteredWords]);

  useEffect(() => { setVisibleCount(100); }, [filterLevels, minLen, minFreq, vocabFilter, masteredFilter, searchQuery]);

  const handleBodyScroll = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    setShowScrollTop(el.scrollTop > 300);
  }, []);

  const scrollToTop = useCallback(() => {
    bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const toggleSelect = useCallback((word: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      return next;
    });
  }, []);

  const buildLangPayload = useCallback((word: string, meaning: string) => {
    const langs = lookupAllLocal(word);
    if (dictMode === 'zh') langs.zh = meaning;
    else if (dictMode === 'en') langs.en = meaning;
    else langs.enSimple = meaning;
    return langs;
  }, [dictMode]);

  const handleMarkSingle = useCallback(async (word: string) => {
    if (!onMarkAsMastered || isMastered(word)) return;
    if (globalVocabulary?.[word]) {
      onMarkAsMastered(word);
      setSelected((prev) => {
        const n = new Set(prev);
        n.delete(word);
        return n;
      });
      return;
    }
    let meaning = lookupMeaning(word, dictMode);
    if (!meaning || isTranslationError(meaning)) {
      setLoadingWord(word);
      meaning = await aiTranslate(word, dictMode);
      setLoadingWord(null);
    }
    const langs = buildLangPayload(word, meaning || '');
    onMarkAsMastered(word, {
      meaning: meaning || langs.zh || langs.en || langs.enSimple || '',
      pos: '',
      meaningZh: langs.zh,
      meaningEn: langs.en,
      meaningEnSimple: langs.enSimple,
    });
    setSelected((prev) => {
      const n = new Set(prev);
      n.delete(word);
      return n;
    });
  }, [onMarkAsMastered, isMastered, globalVocabulary, dictMode, buildLangPayload]);

  const handleBatchMarkMastered = useCallback(async () => {
    if (!onMarkAsMastered) return;
    const wordsToMark = [...selected].filter((w) => !isMastered(w));
    if (wordsToMark.length === 0) return;

    const vocabOnly = wordsToMark.filter((w) => globalVocabulary?.[w]);
    for (const word of vocabOnly) {
      onMarkAsMastered(word);
    }

    const needLookup = wordsToMark.filter((w) => !globalVocabulary?.[w]);
    const localHits = batchLocalLookup(needLookup, dictMode);
    for (const [word, hit] of localHits) {
      onMarkAsMastered(word, {
        meaning: hit.meaning,
        pos: '',
        meaningZh: hit.meaningZh,
        meaningEn: hit.meaningEn,
        meaningEnSimple: hit.meaningEnSimple,
      });
    }

    const needAI = needLookup.filter((w) => !localHits.has(w));
    if (needAI.length > 0) {
      batchAbortRef.current = false;
      setBatchProgress({ done: 0, total: needAI.length });
      const CONCURRENCY = 3;
      let doneCount = 0;
      const queue = [...needAI];

      const worker = async () => {
        while (queue.length > 0 && !batchAbortRef.current) {
          const word = queue.shift()!;
          const meaning = await aiTranslate(word, dictMode);
          if (meaning && !isTranslationError(meaning) && !batchAbortRef.current) {
            const langs = lookupAllLocal(word);
            if (dictMode === 'zh') langs.zh = meaning;
            else if (dictMode === 'en') langs.en = meaning;
            else langs.enSimple = meaning;
            onMarkAsMastered(word, {
              meaning,
              pos: '',
              meaningZh: langs.zh,
              meaningEn: langs.en,
              meaningEnSimple: langs.enSimple,
            });
          }
          doneCount++;
          setBatchProgress({ done: doneCount, total: needAI.length });
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, needAI.length) }, () => worker()),
      );
      setBatchProgress(null);
    }

    setSelected(new Set());
  }, [onMarkAsMastered, selected, isMastered, globalVocabulary, dictMode]);

  const handleAddSingle = useCallback(async (word: string) => {
    if (!onAddToVocabulary) return;
    let meaning = lookupMeaning(word, dictMode);
    if (!meaning || isTranslationError(meaning)) {
      setLoadingWord(word);
      meaning = await aiTranslate(word, dictMode);
      setLoadingWord(null);
    }
    if (!meaning || isTranslationError(meaning)) return;
    const langs = buildLangPayload(word, meaning);
    onAddToVocabulary(word, meaning, '', langs);
    setAddedWords(prev => new Set(prev).add(word));
    setSelected(prev => { const n = new Set(prev); n.delete(word); return n; });
  }, [onAddToVocabulary, dictMode, buildLangPayload]);

  const handleBatchAdd = useCallback(async () => {
    if (!onBatchAddToVocabulary || !onAddToVocabulary || selected.size === 0) return;

    const wordsToAdd: string[] = [];
    for (const word of selected) {
      if (!isInVocab(word) && !isMastered(word)) wordsToAdd.push(word);
    }
    if (wordsToAdd.length === 0) return;

    const localHits = batchLocalLookup(wordsToAdd, dictMode);
    const localEntries: Record<string, { root: string; meaning: string; pos: string; meaningZh?: string; meaningEn?: string; meaningEnSimple?: string }> = {};
    for (const [word, hit] of localHits) {
      localEntries[word] = {
        root: word,
        meaning: hit.meaning,
        pos: '',
        meaningZh: hit.meaningZh,
        meaningEn: hit.meaningEn,
        meaningEnSimple: hit.meaningEnSimple,
      };
    }
    const needAI = wordsToAdd.filter((w) => !localHits.has(w));

    if (Object.keys(localEntries).length > 0) {
      onBatchAddToVocabulary(localEntries);
      setAddedWords(prev => {
        const n = new Set(prev);
        for (const k of Object.keys(localEntries)) n.add(k);
        return n;
      });
    }

    if (needAI.length > 0) {
      batchAbortRef.current = false;
      setBatchProgress({ done: 0, total: needAI.length });
      const CONCURRENCY = 3;
      let doneCount = 0;
      const queue = [...needAI];

      const worker = async () => {
        while (queue.length > 0 && !batchAbortRef.current) {
          const word = queue.shift()!;
          const meaning = await aiTranslate(word, dictMode);
          if (meaning && !isTranslationError(meaning) && !batchAbortRef.current) {
            const langs = lookupAllLocal(word);
            if (dictMode === 'zh') langs.zh = meaning;
            else if (dictMode === 'en') langs.en = meaning;
            else langs.enSimple = meaning;
            onAddToVocabulary(word, meaning, '', langs);
            setAddedWords(prev => new Set(prev).add(word));
          }
          doneCount++;
          setBatchProgress({ done: doneCount, total: needAI.length });
        }
      };

      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, needAI.length) }, () => worker()));
      setBatchProgress(null);
    }

    setSelected(new Set());
  }, [onBatchAddToVocabulary, onAddToVocabulary, selected, dictMode, isInVocab]);

  if (!isOpen || !analysis) return null;

  const q = searchQuery.trim().toLowerCase();
  const filteredWords = analysis.words.filter(w => {
    if (filterLevels.size > 0) {
      const wLevel = w.level || 'unknown';
      if (!filterLevels.has(wLevel)) return false;
    }
    if (minLen > 0 && w.word.length < minLen) return false;
    if (minFreq > 0 && w.count < minFreq) return false;
    const inV = isInVocab(w.word);
    if (vocabFilter === 'hide' && inV) return false;
    if (vocabFilter === 'only' && !inV) return false;
    const inM = isMastered(w.word);
    if (masteredFilter === 'hide' && inM) return false;
    if (masteredFilter === 'only' && !inM) return false;
    if (q && !w.word.toLowerCase().includes(q)) return false;
    return true;
  });

  const addableFiltered = filteredWords.filter(w => !isInVocab(w.word) && !isMastered(w.word));
  const masterableFiltered = filteredWords.filter(w => !isMastered(w.word));
  const selectedInView = filteredWords.filter(w => selected.has(w.word) && !isInVocab(w.word) && !isMastered(w.word));
  const selectedMasterableInView = filteredWords.filter(w => selected.has(w.word) && !isMastered(w.word));
  const allMasterableSelected = masterableFiltered.length > 0 && masterableFiltered.every(w => selected.has(w.word));

  const maxLevelCount = Math.max(...ALL_LEVELS.map(l => analysis.levelUniqueWords[l] || 0), analysis.unknownUniqueCount || 1);

  return (
    <div className="va-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="va-panel" style={{ backgroundColor: headerBg, color: headerTextColor }}>
        <div className="va-header">
          <h3>本书词汇分析</h3>
          <button className="va-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="va-tabs">
          <button className={`va-tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>
            等级分布
          </button>
          <button className={`va-tab ${tab === 'words' ? 'active' : ''}`} onClick={() => setTab('words')}>
            词汇详情
          </button>
        </div>

        <div className="va-body" ref={bodyRef} onScroll={handleBodyScroll} style={{ backgroundColor, color: textColor }}>
          {tab === 'overview' && (
            <div className="va-overview">
              <div className="va-summary">
                <div className="va-stat-card">
                  <div className="va-stat-value">{analysis.totalWords.toLocaleString()}</div>
                  <div className="va-stat-label">总词数</div>
                </div>
                <div className="va-stat-card">
                  <div className="va-stat-value">{analysis.uniqueWords.toLocaleString()}</div>
                  <div className="va-stat-label">不重复词</div>
                </div>
              </div>

              <div className="va-chart">
                <div className="va-chart-title">CEFR 等级分布（不重复词）</div>
                {ALL_LEVELS.map(level => {
                  const count = analysis.levelUniqueWords[level] || 0;
                  const pct = analysis.uniqueWords > 0 ? (count / analysis.uniqueWords * 100) : 0;
                  const barWidth = maxLevelCount > 0 ? (count / maxLevelCount * 100) : 0;
                  return (
                    <div key={level} className="va-bar-row">
                      <div className="va-bar-label" style={{ color: levelColors[level] }}>
                        {level}
                      </div>
                      <div className="va-bar-track">
                        <div
                          className="va-bar-fill"
                          style={{ width: `${barWidth}%`, backgroundColor: levelColors[level] }}
                        />
                      </div>
                      <div className="va-bar-count">{count} <span className="va-bar-pct">({pct.toFixed(1)}%)</span></div>
                    </div>
                  );
                })}
                <div className="va-bar-row">
                  <div className="va-bar-label" style={{ color: isDarkMode ? '#888' : '#999' }}>超纲</div>
                  <div className="va-bar-track">
                    <div
                      className="va-bar-fill"
                      style={{
                        width: `${maxLevelCount > 0 ? (analysis.unknownUniqueCount / maxLevelCount * 100) : 0}%`,
                        backgroundColor: isDarkMode ? '#555' : '#ccc',
                      }}
                    />
                  </div>
                  <div className="va-bar-count">
                    {analysis.unknownUniqueCount}
                    <span className="va-bar-pct"> ({(analysis.uniqueWords > 0 ? analysis.unknownUniqueCount / analysis.uniqueWords * 100 : 0).toFixed(1)}%)</span>
                  </div>
                </div>
              </div>

              <div className="va-chart" style={{ marginTop: 16 }}>
                <div className="va-chart-title">各级别占总词频</div>
                {ALL_LEVELS.map(level => {
                  const count = analysis.levelCounts[level] || 0;
                  const pct = analysis.totalWords > 0 ? (count / analysis.totalWords * 100) : 0;
                  return (
                    <div key={level} className="va-freq-row">
                      <span style={{ color: levelColors[level], fontWeight: 600, width: 28 }}>{level}</span>
                      <span className="va-freq-pct">{pct.toFixed(1)}%</span>
                      <span className="va-freq-count" style={{ opacity: 0.6 }}>({count.toLocaleString()}次)</span>
                    </div>
                  );
                })}
                <div className="va-freq-row">
                  <span style={{ color: isDarkMode ? '#888' : '#999', fontWeight: 600, width: 28 }}>超纲</span>
                  <span className="va-freq-pct">
                    {(analysis.totalWords > 0 ? analysis.unknownCount / analysis.totalWords * 100 : 0).toFixed(1)}%
                  </span>
                  <span className="va-freq-count" style={{ opacity: 0.6 }}>({analysis.unknownCount.toLocaleString()}次)</span>
                </div>
              </div>
            </div>
          )}

          {tab === 'words' && (
            <div className="va-words">
              <div className="va-search-row">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  className="va-search-input"
                  placeholder="搜索单词..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ color: textColor }}
                />
                {searchQuery && (
                  <button className="va-search-clear" onClick={() => setSearchQuery('')} title="清除">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>

              <div className="va-filter">
                <button
                  className={`va-filter-btn ${filterLevels.size === 0 ? 'active' : ''}`}
                  onClick={() => setFilterLevels(new Set())}
                >全部</button>
                {ALL_LEVELS.map(l => (
                  <button
                    key={l}
                    className={`va-filter-btn ${filterLevels.has(l) ? 'active' : ''}`}
                    onClick={() => setFilterLevels(prev => {
                      const next = new Set(prev);
                      if (next.has(l)) next.delete(l); else next.add(l);
                      return next;
                    })}
                    style={filterLevels.has(l) ? { backgroundColor: levelColors[l], borderColor: levelColors[l] } : undefined}
                  >{l}</button>
                ))}
                <button
                  className={`va-filter-btn ${filterLevels.has('unknown') ? 'active' : ''}`}
                  onClick={() => setFilterLevels(prev => {
                    const next = new Set(prev);
                    if (next.has('unknown')) next.delete('unknown'); else next.add('unknown');
                    return next;
                  })}
                >超纲</button>
              </div>

              <div className="va-len-filter">
                <span className="va-len-label">≥字母</span>
                <input
                  className="va-len-input"
                  type="number"
                  min={0} max={20}
                  value={minLen || ''}
                  placeholder="不限"
                  onChange={e => handleMinLenChange(parseInt(e.target.value, 10) || 0)}
                />
                <span className="va-len-sep" />
                <span className="va-len-label">≥频率</span>
                <input
                  className="va-len-input"
                  type="number"
                  min={0} max={999}
                  value={minFreq || ''}
                  placeholder="不限"
                  onChange={e => handleMinFreqChange(parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <div className="va-status-filters">
                <button
                  className={`va-status-btn ${vocabFilter === 'all' ? '' : 'active'}`}
                  onClick={() => setVocabFilter(prev => prev === 'all' ? 'hide' : prev === 'hide' ? 'only' : 'all')}
                >已加入{vocabFilter === 'hide' ? '▪隐藏' : vocabFilter === 'only' ? '▪仅看' : ''}</button>
                <button
                  className={`va-status-btn ${masteredFilter === 'all' ? '' : 'active'}`}
                  onClick={() => setMasteredFilter(prev => prev === 'all' ? 'hide' : prev === 'hide' ? 'only' : 'all')}
                >已掌握{masteredFilter === 'hide' ? '▪隐藏' : masteredFilter === 'only' ? '▪仅看' : ''}</button>
              </div>

              {/* Batch actions bar */}
              {(onAddToVocabulary || onMarkAsMastered) && (
                <div className="va-batch-bar">
                  {batchProgress ? (
                    <div className="va-progress-row">
                      <div className="va-progress-bar">
                        <div className="va-progress-fill" style={{ width: `${batchProgress.total > 0 ? (batchProgress.done / batchProgress.total * 100) : 0}%` }} />
                      </div>
                      <span className="va-progress-text">AI翻译中 {batchProgress.done}/{batchProgress.total}</span>
                      <button className="va-progress-cancel" onClick={() => { batchAbortRef.current = true; }}>取消</button>
                    </div>
                  ) : (
                    <>
                      {onMarkAsMastered && masterableFiltered.length > 0 && (
                        <label className="va-select-all" onClick={() => {
                          if (allMasterableSelected) {
                            setSelected((prev) => {
                              const n = new Set(prev);
                              masterableFiltered.forEach((w) => n.delete(w.word));
                              return n;
                            });
                          } else {
                            setSelected((prev) => {
                              const n = new Set(prev);
                              masterableFiltered.forEach((w) => n.add(w.word));
                              return n;
                            });
                          }
                        }}>
                          <input type="checkbox" checked={allMasterableSelected} readOnly style={{ cursor: 'pointer' }} />
                          <span>全选 ({masterableFiltered.length})</span>
                        </label>
                      )}
                      {onMarkAsMastered && selectedMasterableInView.length > 0 && (
                        <button
                          type="button"
                          className="va-batch-master-btn"
                          onClick={handleBatchMarkMastered}
                          disabled={loadingWord !== null}
                        >
                          标记已掌握 ({selectedMasterableInView.length})
                        </button>
                      )}
                      {onAddToVocabulary && selectedInView.length > 0 && (
                        <button type="button" className="va-batch-add-btn" onClick={handleBatchAdd}>
                          加入词汇表 ({selectedInView.length})
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="va-word-count" style={{ opacity: 0.6 }}>
                共 {filteredWords.length} 个词
              </div>

              <div className="va-word-list">
                {filteredWords.slice(0, visibleCount).map((w) => {
                  const inVocab = isInVocab(w.word);
                  const mastered = isMastered(w.word);
                  const isSelected = selected.has(w.word);
                  // 已加入/已掌握 时仍按 CEFR 级别上色：分级词用对应颜色，超纲用红
                  const tintColor = (inVocab || mastered)
                    ? (w.level ? levelColors[w.level] : '#e74c3c')
                    : undefined;
                  return (
                    <div key={w.word} className={`va-word-item ${inVocab ? 'in-vocab' : ''} ${mastered && !inVocab ? 'mastered' : ''}`}>
                      {onMarkAsMastered && !mastered && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(w.word)}
                          className="va-word-check"
                        />
                      )}
                      {!onMarkAsMastered && onAddToVocabulary && !inVocab && !mastered && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(w.word)}
                          className="va-word-check"
                        />
                      )}
                      {inVocab && (
                        <span className="va-word-done" style={tintColor ? { color: tintColor } : undefined}>✓</span>
                      )}
                      {mastered && !inVocab && (
                        <span className="va-word-mastered" style={tintColor ? { color: tintColor } : undefined}>★</span>
                      )}
                      <span className="va-word-text" style={tintColor ? { color: tintColor, fontWeight: 600 } : undefined}>{w.word}</span>
                      <span className="va-word-level" style={{ color: w.level ? levelColors[w.level] : (isDarkMode ? '#888' : '#999') }}>
                        {w.level ? LEVEL_LABELS[w.level] : '超纲'}
                      </span>
                      <span className="va-word-freq">×{w.count}</span>
                      <div className="va-word-actions">
                        {onMarkAsMastered && !mastered && (
                          <button
                            type="button"
                            className="va-word-master"
                            onClick={() => handleMarkSingle(w.word)}
                            title={inVocab ? '从词汇表移出并标记已掌握' : '标记为已掌握'}
                            disabled={loadingWord === w.word}
                          >
                            {loadingWord === w.word ? '…' : '★'}
                          </button>
                        )}
                        {mastered && onUnmarkMastered && (
                          <button
                            type="button"
                            className="va-word-unmaster"
                            onClick={() => onUnmarkMastered(w.word)}
                            title="取消已掌握"
                          >
                            ↩
                          </button>
                        )}
                        {onAddToVocabulary && !inVocab && !mastered && (
                          <button
                            type="button"
                            className="va-word-add"
                            onClick={() => handleAddSingle(w.word)}
                            title="加入词汇表"
                            disabled={loadingWord === w.word}
                          >
                            {loadingWord === w.word ? '…' : '+'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {visibleCount < filteredWords.length && (
                  <div className="va-load-more">
                    <button onClick={() => setVisibleCount(prev => prev + 100)}>
                      加载更多（已显示 {Math.min(visibleCount, filteredWords.length)}/{filteredWords.length}）
                    </button>
                  </div>
                )}
              </div>

              {showScrollTop && (
                <button className="va-scroll-top" onClick={scrollToTop} title="回到顶部">↑</button>
              )}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .va-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: vaFadeIn 0.15s ease;
        }
        @keyframes vaFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .va-panel {
          width: 90%;
          max-width: 480px;
          max-height: 85vh;
          border-radius: 16px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.2);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: vaSlideUp 0.2s ease;
        }
        @keyframes vaSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .va-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(128,128,128,0.2);
        }
        .va-header h3 { margin: 0; font-size: 16px; font-weight: 600; }
        .va-close {
          background: none; border: none; cursor: pointer;
          padding: 4px; border-radius: 4px; display: flex;
          opacity: 0.7; transition: opacity 0.15s; color: inherit;
        }
        .va-close:hover { opacity: 1; }
        .va-tabs {
          display: flex;
          border-bottom: 1px solid rgba(128,128,128,0.2);
        }
        .va-tab {
          flex: 1;
          padding: 10px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          font-size: 14px;
          color: inherit;
          opacity: 0.6;
          transition: all 0.15s;
        }
        .va-tab.active {
          opacity: 1;
          border-bottom-color: #4a90d9;
          font-weight: 600;
        }
        .va-body {
          flex: 1;
          overflow-y: auto;
          padding: 16px 20px;
          -webkit-overflow-scrolling: touch;
        }
        .va-summary {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
        }
        .va-stat-card {
          flex: 1;
          padding: 14px;
          border-radius: 12px;
          background: rgba(128,128,128,0.08);
          text-align: center;
        }
        .va-stat-value { font-size: 24px; font-weight: 700; }
        .va-stat-label { font-size: 12px; opacity: 0.6; margin-top: 4px; }
        .va-chart-title {
          font-size: 13px;
          font-weight: 600;
          opacity: 0.7;
          margin-bottom: 10px;
        }
        .va-bar-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }
        .va-bar-label { width: 28px; font-size: 13px; font-weight: 600; text-align: right; }
        .va-bar-track {
          flex: 1;
          height: 18px;
          border-radius: 9px;
          background: rgba(128,128,128,0.1);
          overflow: hidden;
        }
        .va-bar-fill {
          height: 100%;
          border-radius: 9px;
          transition: width 0.4s ease;
          min-width: 2px;
        }
        .va-bar-count { font-size: 12px; min-width: 80px; text-align: right; }
        .va-bar-pct { opacity: 0.5; }
        .va-freq-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
          font-size: 13px;
        }
        .va-freq-pct { min-width: 48px; text-align: right; font-weight: 600; }
        .va-freq-count { font-size: 12px; }
        .va-search-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          margin-bottom: 10px;
          border: 1px solid rgba(128,128,128,0.25);
          border-radius: 8px;
        }
        .va-search-input {
          flex: 1;
          border: none;
          outline: none;
          background: transparent;
          font-size: 14px;
        }
        .va-search-input::placeholder { color: #bbb; }
        .va-search-clear {
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px;
          display: flex;
          align-items: center;
        }

        .va-filter {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }
        .va-filter-btn {
          padding: 4px 10px;
          border: 1px solid rgba(128,128,128,0.3);
          border-radius: 6px;
          background: transparent;
          color: inherit;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .va-filter-btn:hover { background: rgba(128,128,128,0.1); }
        .va-len-filter {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          font-size: 12px;
        }
        .va-len-label { opacity: 0.5; white-space: nowrap; }
        .va-len-input {
          width: 52px;
          padding: 4px 6px;
          border: 1px solid rgba(128,128,128,0.3);
          border-radius: 6px;
          background: transparent;
          color: inherit;
          font-size: 13px;
          text-align: center;
          outline: none;
          -moz-appearance: textfield;
        }
        .va-len-input::-webkit-inner-spin-button,
        .va-len-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .va-len-input:focus { border-color: #4a90d9; }
        .va-len-sep { width: 1px; height: 16px; background: rgba(128,128,128,0.2); flex-shrink: 0; }
        .va-status-filters {
          display: flex;
          gap: 6px;
          margin-top: 8px;
          flex-wrap: wrap;
        }
        .va-status-btn {
          padding: 3px 10px;
          border: 1px solid rgba(128,128,128,0.3);
          border-radius: 12px;
          background: transparent;
          color: inherit;
          font-size: 12px;
          cursor: pointer;
          opacity: 0.6;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .va-status-btn.active {
          opacity: 1;
          border-color: #4a90d9;
          color: #4a90d9;
        }
        .va-filter-btn.active {
          background: #4a90d9;
          color: white;
          border-color: #4a90d9;
        }
        .va-batch-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
          padding: 8px 10px;
          border-radius: 8px;
          background: rgba(128,128,128,0.06);
        }
        .va-select-all {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          cursor: pointer;
          user-select: none;
        }
        .va-select-all input { width: 15px; height: 15px; margin: 0; }
        .va-batch-add-btn {
          padding: 5px 12px;
          border: none;
          border-radius: 6px;
          background: #4a90d9;
          color: white;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s;
        }
        .va-batch-add-btn:hover { background: #3a7bc8; }
        .va-batch-master-btn {
          padding: 5px 12px;
          border: none;
          border-radius: 6px;
          background: #f59e0b;
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s;
        }
        .va-batch-master-btn:hover:not(:disabled) { background: #d97706; }
        .va-batch-master-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .va-progress-row {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
        }
        .va-progress-bar {
          flex: 1;
          height: 6px;
          border-radius: 3px;
          background: rgba(128,128,128,0.15);
          overflow: hidden;
        }
        .va-progress-fill {
          height: 100%;
          border-radius: 3px;
          background: #4a90d9;
          transition: width 0.3s ease;
        }
        .va-progress-text {
          font-size: 11px;
          opacity: 0.7;
          white-space: nowrap;
        }
        .va-progress-cancel {
          padding: 2px 8px;
          border: 1px solid rgba(128,128,128,0.3);
          border-radius: 4px;
          background: transparent;
          color: inherit;
          font-size: 11px;
          cursor: pointer;
          white-space: nowrap;
        }
        .va-word-count { font-size: 12px; margin-bottom: 8px; }
        .va-word-list { display: flex; flex-direction: column; }
        .va-word-item {
          display: flex;
          align-items: center;
          padding: 6px 0;
          border-bottom: 1px solid rgba(128,128,128,0.08);
          font-size: 14px;
          gap: 6px;
        }
        .va-word-item.in-vocab { opacity: 0.85; }
        .va-word-item.mastered { opacity: 0.8; }
        .va-word-check { width: 15px; height: 15px; margin: 0; cursor: pointer; flex-shrink: 0; }
        .va-word-done { width: 15px; font-size: 11px; color: #22c55e; flex-shrink: 0; text-align: center; }
        .va-word-mastered { width: 15px; font-size: 11px; color: #f59e0b; flex-shrink: 0; text-align: center; }
        .va-word-text { flex: 1; font-weight: 500; }
        .va-word-level { font-size: 11px; margin-right: 4px; flex-shrink: 0; }
        .va-word-freq { font-size: 12px; opacity: 0.5; min-width: 32px; text-align: right; flex-shrink: 0; }
        .va-word-actions {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }
        .va-word-master,
        .va-word-unmaster,
        .va-word-add {
          width: 24px; height: 24px;
          border: 1px solid rgba(128,128,128,0.3);
          border-radius: 6px;
          background: transparent;
          color: inherit;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .va-word-master {
          color: #f59e0b;
          border-color: rgba(245, 158, 11, 0.45);
        }
        .va-word-master:hover:not(:disabled) {
          background: rgba(245, 158, 11, 0.12);
        }
        .va-word-unmaster {
          font-size: 12px;
          opacity: 0.75;
        }
        .va-word-unmaster:hover {
          background: rgba(128, 128, 128, 0.1);
        }
        .va-word-add {
          font-size: 16px;
          transition: all 0.15s;
          margin-left: 4px;
        }
        .va-word-add:hover { background: #4a90d9; color: white; border-color: #4a90d9; }
        .va-load-more {
          padding: 12px 0;
          text-align: center;
        }
        .va-load-more button {
          padding: 6px 20px;
          border: 1px solid rgba(128,128,128,0.3);
          border-radius: 8px;
          background: transparent;
          color: inherit;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .va-load-more button:hover { background: rgba(128,128,128,0.1); }
        .va-scroll-top {
          position: sticky;
          bottom: 12px;
          float: right;
          margin-right: 4px;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: none;
          background: #4a90d9;
          color: white;
          font-size: 18px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
          transition: opacity 0.2s;
        }
        .va-scroll-top:hover { opacity: 0.85; }
      `}</style>
    </div>
  );
}
