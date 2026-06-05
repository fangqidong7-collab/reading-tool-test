"use client";

import React from "react";
import { ReadingArea, type ReadingAreaRef } from "@/components/ReadingArea";
import { WordTooltip } from "@/components/WordTooltip";
import { VocabularySidebar } from "@/components/VocabularySidebar";
import { SettingsPanel } from "@/components/SettingsPanel";
import { SyncPanel } from "@/components/SyncPanel";
import { BookVocabAnalysis } from "@/components/BookVocabAnalysis";
import { ReadingStatsPanel } from "@/components/ReadingStatsPanel";
import { useTTS, SPEED_OPTIONS } from "@/hooks/useTTS";
import type { FontFamilySetting, CefrColorPaletteId, AnnotationDisplayMode } from "@/hooks/useReadingSettings";
import type { ReadingStatsReturn } from "@/hooks/useReadingStats";
import type { Book, ProcessedContent, SentenceAnnotation } from "@/hooks/useBookshelf";
import { resolveAnnotation } from "@/lib/dictionary";
interface AnnotatedWord {
  root: string;
  meaning: string;
  pos: string;
  count: number;
  cefrLevel?: string;
}

export interface ReadingHomeViewProps {
  // Reading area ref
  containerRef: React.RefObject<HTMLDivElement | null>;
  readingAreaRef: React.RefObject<ReadingAreaRef | null>;
  // Book data
  currentBook: Book | null;
  // Processed content
  processedContent: ProcessedContent | null;
  annotations: Record<string, AnnotatedWord>;
  mergedAnnotationsForRender: Record<string, AnnotatedWord>;
  sidebarAnnotations: Record<string, AnnotatedWord>;
  // State
  text: string;
  loading: boolean;
  annotating: boolean;
  sidebarOpen: boolean;
  settingsPanelOpen: boolean;
  leftDrawerOpen: boolean;
  leftDrawerTab: "toc" | "bookmarks";
  tocReversed: boolean;
  tocScrollContainerRef: React.RefObject<HTMLDivElement | null>;
  currentScrollPercent: number;
  currentParagraphIndex: number;
  currentParagraphText: string;
  currentChapterTitle: string;
  // Search
  searchOpen: boolean;
  searchQuery: string;
  searchResults: Array<{ paragraphIndex: number; charIndex: number }>;
  currentSearchIndex: number;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  // More menu
  moreMenuOpen: boolean;
  // Sentence selection
  pendingSelection: { text: string; position: { x: number; y: number } } | null;
  translatingSelection: boolean;
  // Selected word
  selectedWord: { word: string; lemma: string; position: { x: number; y: number } } | null;
  // Theme
  backgroundColor: string;
  headerBg: string;
  headerTextColor: string;
  textColor: string;
  annotationColor: string;
  highlightBg: string;
  highlightBgHover: string;
  sidebarBg: string;
  isDarkMode: boolean;
  // Settings
  fontSize: number;
  lineHeight: number;
  currentTheme: string;
  dictMode: "zh" | "en" | "en-simple";
  pageTurnRatio: number;
  clickToTurnPage: boolean;
  vocabLevel: string;
  setVocabLevel: (level: string) => void;
  fontFamily: FontFamilySetting;
  fontFamilyCss: string;
  setFontFamily: (family: FontFamilySetting) => void;
  autoTheme: boolean;
  setAutoTheme: (enabled: boolean) => void;
  cefrColorPalette: CefrColorPaletteId;
  setCefrColorPalette: (paletteId: CefrColorPaletteId) => void;
  annotationDisplayMode: AnnotationDisplayMode;
  setAnnotationDisplayMode: (mode: AnnotationDisplayMode) => void;
  annotationFontSize: number;
  setAnnotationFontSize: (size: number) => void;
  readingStats: ReadingStatsReturn;
  // Dict status
  dictLoadStatus: string;
  // Sync
  syncPanelOpen: boolean;
  setSyncPanelOpen: (open: boolean) => void;
  setSyncJustCreated: (v: boolean) => void;
  syncCode: string | null;
  syncing: boolean;
  lastSyncAt: number | null;
  syncError: string | null;
  syncJustCreated: boolean;
  handleCreateSync: () => Promise<void>;
  handleBindSync: (code: string) => Promise<void>;
  handleSync: () => Promise<void>;
  unbind: () => void;
  // Callbacks - word & annotation
  handleWordClick: (word: string, lemma: string, event: React.MouseEvent) => void;
  handleWordDoubleClick: (word: string, lemma: string, event: React.MouseEvent) => void;
  getWordAnnotation: (word: string) => AnnotatedWord | null;
  isClickable: (word: string) => boolean;
  annotateAll: (word: string) => Promise<void>;
  removeAnnotation: (word: string, lemma?: string) => void;
  clearAllAnnotations: () => void;
  scrollToWord: (word: string) => void;
  scrollToSentence: (annotation: SentenceAnnotation) => void;
  handleRemoveSentenceAnnotation: (annotationId: string) => void;
  // Callbacks - bookmarks & TOC
  goToParagraph: (paragraphIndex: number) => void;
  toggleCurrentBookmark: () => void;
  removeBookmark: (bookId: string, bookmarkId: string) => void;
  handleReturnToBookshelf: () => void;
  // Callbacks - UI
  handleSidebarToggle: () => void;
  handleTocClick: () => void;
  handleBookmarkClick: () => void;
  closeTooltip: () => void;
  handleTextSelect: (selection: {
    text: string;
    startParagraphIndex: number;
    endParagraphIndex: number;
    startCharIndex: number;
    endCharIndex: number;
  }) => void;
  handleTranslateSentence: () => void;
  handleAddNote: (noteText: string) => void;
  closePendingSelection: () => void;
  // Callbacks - settings
  setFontSize: (size: number) => void;
  setLineHeight: (height: number) => void;
  setBackgroundTheme: (theme: string) => void;
  resetToDefault: () => void;
  setDictMode: (mode: "zh" | "en" | "en-simple") => void;
  setPageTurnRatio: (ratio: number) => void;
  setClickToTurnPage: (enabled: boolean) => void;
  // Callbacks - state setters
  setCurrentScrollPercent: (percent: number) => void;
  setCurrentParagraphIndex: (index: number) => void;
  setCurrentParagraphText: (text: string) => void;
  setCurrentParagraphOffsetRatio: (ratio: number) => void;
  setCurrentChapterTitle: (title: string) => void;
  setSidebarOpen: (open: boolean) => void;
  setSettingsPanelOpen: (open: boolean) => void;
  setLeftDrawerOpen: (open: boolean) => void;
  setLeftDrawerTab: (tab: "toc" | "bookmarks") => void;
  setTocReversed: (reversed: boolean) => void;
  setMoreMenuOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: Array<{ paragraphIndex: number; charIndex: number }>) => void;
  setCurrentSearchIndex: (index: number) => void;
  // Search actions
  handleSearchInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  goToNextSearchResult: () => void;
  goToPrevSearchResult: () => void;
  closeSearch: () => void;
  // Vocabulary
  globalVocabulary?: Record<string, { root: string; meaning: string; pos: string }>;
  masteredWords?: Set<string>;
  masteredVocabulary?: Record<string, { root: string; meaning: string; pos: string; meaningZh?: string; meaningEn?: string; meaningEnSimple?: string }>;
  restoreFromMastered?: (root: string) => void;
  removeFromMastered?: (root: string) => void;
  addToGlobalVocabulary?: (word: string, meaning: string, pos: string, langs?: { zh?: string; en?: string; enSimple?: string }) => void;
  mergeGlobalVocabulary?: (entries: Record<string, { root: string; meaning: string; pos: string; meaningZh?: string; meaningEn?: string; meaningEnSimple?: string }>) => void;
  markWordAsMastered?: (
    word: string,
    supplemental?: { meaning?: string; pos?: string; meaningZh?: string; meaningEn?: string; meaningEnSimple?: string },
  ) => void;
  lookupOnlineWord: (word: string, lemma: string) => Promise<string | null>;
}

const noteInputColors = {
  light: { bg: "#8898A8", text: "#fff" },
  dark: { bg: "#8898A8", text: "#fff" },
  noteBtn: { light: "#8898A8", dark: "#7A8B9E" },
};

export function ReadingHomeView(props: ReadingHomeViewProps) {
  const {
    containerRef,
    readingAreaRef,
    currentBook,
    processedContent,
    annotations,
    mergedAnnotationsForRender,
    sidebarAnnotations,
    text,
    loading,
    annotating,
    sidebarOpen,
    settingsPanelOpen,
    leftDrawerOpen,
    leftDrawerTab,
    tocReversed,
    tocScrollContainerRef,
    currentScrollPercent,
    currentParagraphIndex,
    currentParagraphText,
    currentChapterTitle,
    searchOpen,
    searchQuery,
    searchResults,
    currentSearchIndex,
    searchInputRef,
    moreMenuOpen,
    pendingSelection,
    translatingSelection,
    selectedWord,
    backgroundColor,
    headerBg,
    headerTextColor,
    textColor,
    annotationColor,
    highlightBg,
    highlightBgHover,
    sidebarBg,
    isDarkMode,
    fontSize,
    lineHeight,
    currentTheme,
    dictMode,
    pageTurnRatio,
    clickToTurnPage,
    vocabLevel,
    setVocabLevel,
    fontFamily,
    fontFamilyCss,
    setFontFamily,
    autoTheme,
    setAutoTheme,
    cefrColorPalette,
    setCefrColorPalette,
    annotationDisplayMode,
    setAnnotationDisplayMode,
    annotationFontSize,
    setAnnotationFontSize,
    readingStats,
    dictLoadStatus,
    syncPanelOpen,
    setSyncPanelOpen,
    setSyncJustCreated,
    syncCode,
    syncing,
    lastSyncAt,
    syncError,
    syncJustCreated,
    handleCreateSync,
    handleBindSync,
    handleSync,
    unbind,
    handleWordClick,
    handleWordDoubleClick,
    getWordAnnotation,
    isClickable,
    annotateAll,
    removeAnnotation,
    clearAllAnnotations,
    scrollToWord,
    scrollToSentence,
    handleRemoveSentenceAnnotation,
    goToParagraph,
    toggleCurrentBookmark,
    removeBookmark,
    handleReturnToBookshelf,
    handleSidebarToggle,
    handleTocClick,
    handleBookmarkClick,
    closeTooltip,
    handleTextSelect,
    handleTranslateSentence,
    handleAddNote,
    closePendingSelection,
    setFontSize,
    setLineHeight,
    setBackgroundTheme,
    resetToDefault,
    setDictMode,
    setPageTurnRatio,
    setClickToTurnPage,
    setCurrentScrollPercent,
    setCurrentParagraphIndex,
    setCurrentParagraphText,
    setCurrentParagraphOffsetRatio,
    setCurrentChapterTitle,
    setSidebarOpen,
    setSettingsPanelOpen,
    setLeftDrawerOpen,
    setLeftDrawerTab,
    setTocReversed,
    setMoreMenuOpen,
    setSearchOpen,
    setSearchQuery,
    setSearchResults,
    setCurrentSearchIndex,
    handleSearchInput,
    goToNextSearchResult,
    goToPrevSearchResult,
    closeSearch,
    globalVocabulary,
    masteredWords,
    masteredVocabulary,
    restoreFromMastered,
    removeFromMastered,
    addToGlobalVocabulary,
    mergeGlobalVocabulary,
    markWordAsMastered,
    lookupOnlineWord,
  } = props;

  const [showNoteInput, setShowNoteInput] = React.useState(false);
  const [noteText, setNoteText] = React.useState("");
  const noteInputRef = React.useRef<HTMLTextAreaElement>(null);

  const [vocabAnalysisOpen, setVocabAnalysisOpen] = React.useState(false);
  const [readingStatsOpen, setReadingStatsOpen] = React.useState(false);

  // TTS state & sentence queue
  const [ttsOpen, setTtsOpen] = React.useState(false);
  const [ttsSpeed, setTtsSpeed] = React.useState('1.0x');
  const [ttsCurrentSentenceId, setTtsCurrentSentenceId] = React.useState("");
  const ttsSentencesRef = React.useRef<Array<{ id: string; text: string }>>([]);
  const ttsIndexRef = React.useRef(0);
  const ttsPlayRef = React.useRef<(text: string, key?: string) => void>(() => {});
  const ttsPlayUriRef = React.useRef<(uri: string) => void>(() => {});
  const ttsFetchRef = React.useRef<(text: string, key: string) => Promise<string | null>>(async () => null);
  const ttsStopRef = React.useRef<() => void>(() => {});

  const prefetchAhead = React.useCallback((fromIndex: number) => {
    const queue = ttsSentencesRef.current;
    for (let i = fromIndex; i < fromIndex + 2 && i < queue.length; i++) {
      ttsFetchRef.current(queue[i].text, queue[i].id);
    }
  }, []);

  const { isPlaying: ttsIsPlaying, isPaused: ttsIsPaused, isLoading: ttsIsLoading, play: ttsPlay, playAudioUri: ttsPlayUri, fetchAudio: ttsFetch, stop: ttsStop, pause: ttsPause, resume: ttsResume, setSpeed, useLocalTTS, hasLocalTTS, setTTSSource, voices: ttsVoices, voiceIndex: ttsVoiceIndex, selectVoice: ttsSelectVoice } = useTTS({
    onComplete: () => {
      const nextIndex = ttsIndexRef.current + 1;
      const queue = ttsSentencesRef.current;
      if (nextIndex >= queue.length) {
        ttsStopRef.current();
        setTtsOpen(false);
        setTtsCurrentSentenceId("");
        return;
      }
      ttsIndexRef.current = nextIndex;
      setTtsCurrentSentenceId(queue[nextIndex].id);
      ttsPlayRef.current(queue[nextIndex].text, queue[nextIndex].id);
      prefetchAhead(nextIndex + 1);
    },
    onError: (msg) => {
      console.error('[TTS] stopped due to error:', msg);
      ttsStopRef.current();
      setTtsOpen(false);
      setTtsCurrentSentenceId("");
    },
  });
  React.useEffect(() => { ttsPlayRef.current = ttsPlay; }, [ttsPlay]);
  React.useEffect(() => { ttsPlayUriRef.current = ttsPlayUri; }, [ttsPlayUri]);
  React.useEffect(() => { ttsFetchRef.current = ttsFetch; }, [ttsFetch]);
  React.useEffect(() => { ttsStopRef.current = ttsStop; }, [ttsStop]);

  const hasLetterOrDigit = React.useCallback((s: string) => /[a-zA-Z0-9\u4e00-\u9fff]/.test(s), []);

  const splitParaSentences = React.useCallback((paraText: string): string[] => {
    const ABBR_RE = /\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|Gen|Gov|Sgt|Cpl|Pvt|Capt|Lt|Col|Maj|Rev|Hon|Drs|Messrs|Mmes|No|Nos|Vol|vs|etc|al|approx|dept|est|govt|incl|intl|natl|assn|ave|blvd|dept|dist|div|est|ext|ft|hwy|inc|ltd|mt|pkg|pres|govt|univ)\.\s/gi;
    const placeholders: string[] = [];
    const protected_ = paraText.replace(ABBR_RE, (match) => {
      const idx = placeholders.length;
      placeholders.push(match);
      return `\x00ABBR${idx}\x00`;
    });

    const rawParts = protected_.match(/[^.!?。！？；;]*[.!?。！？；;]+["'""''）)»\s]*/g) || [];
    const merged: string[] = [];
    for (const part of rawParts) {
      if (merged.length > 0 && !/\s$/.test(merged[merged.length - 1])) {
        merged[merged.length - 1] += part;
      } else {
        merged.push(part);
      }
    }
    const matched = rawParts.join('');
    const remainder = protected_.slice(matched.length).trim();
    const result = merged.map(s => s.trim()).filter(Boolean);
    if (remainder && hasLetterOrDigit(remainder)) result.push(remainder);
    if (result.length === 0 && paraText.trim()) result.push(paraText.trim());

    const restored = result.map(s =>
      s.replace(/\x00ABBR(\d+)\x00/g, (_, i) => placeholders[parseInt(i)])
    );
    return restored.filter(hasLetterOrDigit);
  }, [hasLetterOrDigit]);

  const handleStartTTS = React.useCallback(async () => {
    if (!processedContent || processedContent.length === 0) return;
    const startP = currentParagraphIndex >= 0 ? currentParagraphIndex : 0;
    const queue: Array<{ id: string; text: string }> = [];
    for (let p = startP; p < processedContent.length; p++) {
      const paraText = processedContent[p].segments.map((s: { text: string }) => s.text).join("");
      const sentences = splitParaSentences(paraText);
      sentences.forEach((text, sIdx) => {
        queue.push({ id: `tts-p${p}-s${sIdx}`, text });
      });
    }
    if (queue.length === 0) return;
    ttsSentencesRef.current = queue;
    ttsIndexRef.current = 0;
    setTtsOpen(true);
    setTtsCurrentSentenceId(queue[0].id);
    ttsPlay(queue[0].text, queue[0].id);
    prefetchAhead(1);
  }, [processedContent, currentParagraphIndex, splitParaSentences, ttsPlay, prefetchAhead]);

  const handleStopTTS = React.useCallback(() => {
    ttsStop();
    setTtsOpen(false);
    setTtsCurrentSentenceId("");
    ttsSentencesRef.current = [];
    ttsIndexRef.current = 0;
  }, [ttsStop]);

  const handlePrevSentence = React.useCallback(() => {
    const queue = ttsSentencesRef.current;
    if (queue.length === 0) return;
    const prevIdx = Math.max(0, ttsIndexRef.current - 1);
    ttsStop();
    ttsIndexRef.current = prevIdx;
    setTtsCurrentSentenceId(queue[prevIdx].id);
    ttsPlayRef.current(queue[prevIdx].text, queue[prevIdx].id);
    prefetchAhead(prevIdx + 1);
  }, [ttsStop, prefetchAhead]);

  const handleNextSentence = React.useCallback(() => {
    const queue = ttsSentencesRef.current;
    if (queue.length === 0) return;
    const nextIdx = ttsIndexRef.current + 1;
    if (nextIdx >= queue.length) return;
    ttsStop();
    ttsIndexRef.current = nextIdx;
    setTtsCurrentSentenceId(queue[nextIdx].id);
    ttsPlayRef.current(queue[nextIdx].text, queue[nextIdx].id);
    prefetchAhead(nextIdx + 1);
  }, [ttsStop, prefetchAhead]);

  // Auto-scroll: only scroll when the paragraph being read falls below 80% of the viewport
  React.useEffect(() => {
    if (!ttsOpen || !ttsCurrentSentenceId) return;
    const parsed = ttsCurrentSentenceId.match(/^tts-p(\d+)-s\d+$/);
    if (!parsed) return;
    const pIdx = parseInt(parsed[1], 10);

    const scrollEl = document.querySelector('.reading-container') as HTMLElement;
    if (!scrollEl) { goToParagraph(pIdx); return; }

    const paraEl = scrollEl.querySelector(`[data-paragraph-index="${pIdx}"]`) as HTMLElement;
    if (!paraEl) { goToParagraph(pIdx); return; }

    const containerRect = scrollEl.getBoundingClientRect();
    const paraRect = paraEl.getBoundingClientRect();
    const threshold = containerRect.top + containerRect.height * 0.8;

    if (paraRect.top > threshold || paraRect.bottom < containerRect.top) {
      goToParagraph(pIdx);
    }
  }, [ttsOpen, ttsCurrentSentenceId, goToParagraph]);

  React.useEffect(() => {
    if (!pendingSelection) {
      setShowNoteInput(false);
      setNoteText("");
    }
  }, [pendingSelection]);

  React.useEffect(() => {
    if (showNoteInput) {
      setTimeout(() => noteInputRef.current?.focus(), 50);
    }
  }, [showNoteInput]);

  return (
    <div className="app-container" style={{ backgroundColor }}>
      {/* Reading Stats Panel */}
      <ReadingStatsPanel
        isOpen={readingStatsOpen}
        onClose={() => setReadingStatsOpen(false)}
        stats={readingStats}
        headerBg={headerBg}
        headerTextColor={headerTextColor}
        textColor={textColor}
        isDarkMode={isDarkMode}
        backgroundColor={backgroundColor}
      />

      {/* Vocab Analysis Modal */}
      <BookVocabAnalysis
        isOpen={vocabAnalysisOpen}
        onClose={() => setVocabAnalysisOpen(false)}
        processedContent={processedContent}
        headerBg={headerBg}
        headerTextColor={headerTextColor}
        textColor={textColor}
        isDarkMode={isDarkMode}
        backgroundColor={backgroundColor}
        globalVocabulary={globalVocabulary}
        masteredWords={masteredWords}
        onAddToVocabulary={addToGlobalVocabulary}
        onBatchAddToVocabulary={mergeGlobalVocabulary}
        onMarkAsMastered={markWordAsMastered}
        onUnmarkMastered={removeFromMastered}
        dictMode={dictMode}
        cefrColorPalette={cefrColorPalette}
      />

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={settingsPanelOpen}
        onClose={() => setSettingsPanelOpen(false)}
        fontSize={fontSize}
        lineHeight={lineHeight}
        currentTheme={currentTheme}
        onFontSizeChange={setFontSize}
        onLineHeightChange={setLineHeight}
        onThemeChange={setBackgroundTheme}
        onReset={resetToDefault}
        headerBg={headerBg}
        headerTextColor={headerTextColor}
        textColor={textColor}
        isDarkMode={isDarkMode}
        dictMode={dictMode}
        onDictModeChange={setDictMode}
        pageTurnRatio={pageTurnRatio}
        onPageTurnRatioChange={setPageTurnRatio}
        clickToTurnPage={clickToTurnPage}
        onClickToTurnPageChange={setClickToTurnPage}
        vocabLevel={vocabLevel}
        onVocabLevelChange={setVocabLevel}
        fontFamily={fontFamily}
        onFontFamilyChange={setFontFamily}
        autoTheme={autoTheme}
        onAutoThemeChange={setAutoTheme}
        cefrColorPalette={cefrColorPalette}
        onCefrColorPaletteChange={setCefrColorPalette}
        annotationDisplayMode={annotationDisplayMode}
        onAnnotationDisplayModeChange={setAnnotationDisplayMode}
        annotationFontSize={annotationFontSize}
        onAnnotationFontSizeChange={setAnnotationFontSize}
      />

      {/* Cloud Sync Panel */}
      <SyncPanel
        isOpen={syncPanelOpen}
        onClose={() => {
          setSyncPanelOpen(false);
          setSyncJustCreated(false);
        }}
        syncCode={syncCode}
        syncing={syncing}
        lastSyncAt={lastSyncAt}
        syncError={syncError}
        onCreateSync={handleCreateSync}
        onBindCode={handleBindSync}
        onSync={handleSync}
        onUnbind={unbind}
        isDarkMode={isDarkMode}
        justCreated={syncJustCreated}
      />

      {/* Left Drawer - TOC and Bookmarks */}
      <div className={`left-drawer-overlay ${leftDrawerOpen ? "open" : ""}`} onClick={() => setLeftDrawerOpen(false)} />
      <div
        className={`left-drawer ${leftDrawerOpen ? "open" : ""}`}
        style={{ backgroundColor: isDarkMode ? "#1e1e2e" : "#ffffff" }}
      >
        <div className="left-drawer-header" style={{ borderBottomColor: isDarkMode ? "#333" : "#e0e0e0" }}>
          <div className="left-drawer-tabs">
            <button
              className={`drawer-tab ${leftDrawerTab === "toc" ? "active" : ""}`}
              onClick={() => setLeftDrawerTab("toc")}
              style={{
                color:
                  leftDrawerTab === "toc"
                    ? isDarkMode
                      ? "#8898A8"
                      : "#8898A8"
                    : isDarkMode
                      ? "#888"
                      : "#666",
                borderBottomColor:
                  leftDrawerTab === "toc"
                    ? isDarkMode
                      ? "#8898A8"
                      : "#8898A8"
                    : "transparent",
              }}
            >
              目录
            </button>
            <button
              className={`drawer-tab ${leftDrawerTab === "bookmarks" ? "active" : ""}`}
              onClick={() => setLeftDrawerTab("bookmarks")}
              style={{
                color:
                  leftDrawerTab === "bookmarks"
                    ? isDarkMode
                      ? "#8898A8"
                      : "#8898A8"
                    : isDarkMode
                      ? "#888"
                      : "#666",
                borderBottomColor:
                  leftDrawerTab === "bookmarks"
                    ? isDarkMode
                      ? "#8898A8"
                      : "#8898A8"
                    : "transparent",
              }}
            >
              书签 ({currentBook?.bookmarks?.length || 0})
            </button>
          </div>
          <button
            className="drawer-close"
            onClick={() => setLeftDrawerOpen(false)}
            style={{ color: isDarkMode ? "#888" : "#666" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="left-drawer-content" ref={tocScrollContainerRef}>
          {/* TOC Tab */}
          {leftDrawerTab === "toc" && (
            <div className="toc-list">
              {currentBook?.tableOfContents && currentBook.tableOfContents.length > 0 ? (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 12px",
                      borderBottom: `1px solid ${isDarkMode ? "#333" : "#eee"}`,
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      backgroundColor: isDarkMode ? "#1e1e2e" : "#fff",
                    }}
                  >
                    {currentBook.tableOfContents.length > 10 && (
                      <button
                        onClick={() => {
                          const container = tocScrollContainerRef.current;
                          if (container) {
                            container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
                          }
                        }}
                        style={{
                          background: "none",
                          border: `1px solid ${isDarkMode ? "#555" : "#ddd"}`,
                          borderRadius: "4px",
                          padding: "4px 10px",
                          fontSize: "12px",
                          color: isDarkMode ? "#aaa" : "#666",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="7 13 12 18 17 13" />
                          <polyline points="7 6 12 11 17 6" />
                        </svg>
                        到底部
                      </button>
                    )}
                    <button
                      onClick={() => setTocReversed(!tocReversed)}
                      style={{
                        background: "none",
                        border: `1px solid ${isDarkMode ? "#555" : "#ddd"}`,
                        borderRadius: "4px",
                        padding: "4px 10px",
                        fontSize: "12px",
                        color: isDarkMode ? "#aaa" : "#666",
                        cursor: "pointer",
                      }}
                    >
                      {tocReversed ? "倒序 ↑" : "正序 ↓"}
                    </button>
                  </div>
                  {(tocReversed
                    ? [...currentBook.tableOfContents].reverse()
                    : currentBook.tableOfContents
                  ).map((entry, index) => {
                    const originalIndex = tocReversed
                      ? currentBook.tableOfContents!.length - 1 - index
                      : index;
                    const nextEntry = currentBook.tableOfContents![originalIndex + 1];
                    const isActive =
                      entry.paragraphIndex !== undefined &&
                      entry.paragraphIndex <= currentParagraphIndex &&
                      (nextEntry === undefined ||
                        nextEntry.paragraphIndex === undefined ||
                        nextEntry.paragraphIndex > currentParagraphIndex);

                    return (
                      <button
                        key={originalIndex}
                        className={`toc-item ${isActive ? "toc-active" : ""}`}
                        onClick={() => {
                          if (entry.paragraphIndex !== undefined) {
                            goToParagraph(entry.paragraphIndex);
                          } else {
                            readingAreaRef.current?.restoreScrollPosition(entry.page);
                          }
                        }}
                        style={{
                          color: isActive
                            ? isDarkMode
                              ? "#8898A8"
                              : "#8898A8"
                            : isDarkMode
                              ? "#ccc"
                              : "#333",
                          fontWeight: isActive ? 600 : 400,
                          backgroundColor: isActive
                            ? isDarkMode
                              ? "rgba(74,144,217,0.1)"
                              : "rgba(74,144,217,0.08)"
                            : "transparent",
                        }}
                      >
                        {entry.title}
                      </button>
                    );
                  })}
                </>
              ) : (
                <div className="empty-message" style={{ color: isDarkMode ? "#666" : "#999" }}>
                  {currentBook?.isSample ? "示例书籍暂无目录" : "暂无目录信息"}
                </div>
              )}
            </div>
          )}

          {/* Bookmarks Tab */}
          {leftDrawerTab === "bookmarks" && (
            <div className="bookmark-list">
              {currentBook?.bookmarks && currentBook.bookmarks.length > 0 ? (
                <>
                  <button
                    className="add-bookmark-btn"
                    onClick={toggleCurrentBookmark}
                    style={{
                      backgroundColor: isDarkMode ? "#3a3a4e" : "#f0f0f0",
                      color: isDarkMode ? "#8898A8" : "#8898A8",
                    }}
                  >
                    {currentBook.bookmarks.some((bm) => bm.page === currentScrollPercent)
                      ? "移除当前位置书签"
                      : "添加当前位置书签"}
                  </button>
                  {currentBook.bookmarks
                    .sort((a, b) => a.page - b.page)
                    .map((bookmark) => (
                      <div
                        key={bookmark.id}
                        className="bookmark-item"
                        style={{ backgroundColor: isDarkMode ? "#2a2a3e" : "#f8f9fa" }}
                      >
                        <button
                          className="bookmark-page"
                          onClick={() => readingAreaRef.current?.restoreScrollPosition(bookmark.page)}
                          style={{ color: isDarkMode ? "#ccc" : "#333" }}
                        >
                          {bookmark.previewText || `位置 ${Math.round(bookmark.page)}%`}
                        </button>
                        <button
                          className="bookmark-delete"
                          onClick={() => removeBookmark(currentBook!.id, bookmark.id)}
                          style={{ color: isDarkMode ? "#888" : "#999" }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    ))}
                </>
              ) : (
                <div className="empty-message" style={{ color: isDarkMode ? "#666" : "#999" }}>
                  <p>暂无书签</p>
                  <button
                    className="add-bookmark-btn"
                    onClick={toggleCurrentBookmark}
                    style={{
                      backgroundColor: isDarkMode ? "#3a3a4e" : "#f0f0f0",
                      color: isDarkMode ? "#8898A8" : "#8898A8",
                    }}
                  >
                    添加当前页书签
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 标注进度条 - 顶部加载条 */}
      {annotating && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            height: "3px",
            background: "rgba(0,0,0,0.05)",
            zIndex: 9999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: "30%",
              background: "linear-gradient(90deg, #8898A8, #8898A8, #8898A8)",
              borderRadius: "0 2px 2px 0",
              animation: "topBarSlide 1.2s ease-in-out infinite",
            }}
          />
        </div>
      )}

      {/* Reading Header */}
      <header className="app-header" style={{ backgroundColor: headerBg, color: headerTextColor }}>
        <div className="header-left">
          <button
            className="back-btn"
            onClick={handleReturnToBookshelf}
            style={{
              backgroundColor: isDarkMode ? "#2a2a3e" : "#f5f5f5",
              color: isDarkMode ? "#ccc" : "#666",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <span
            style={{
              flex: 1,
              textAlign: "left",
              fontSize: "14px",
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              padding: "0 4px",
            }}
          >
            {currentChapterTitle || currentBook?.title}
          </span>
        </div>

        <div className="header-right">
          {/* TOC Button - right second */}
          <button
            className={`toc-btn nav-btn-catalog ${isDarkMode ? "dark" : ""}`}
            onClick={handleTocClick}
            style={{
              backgroundColor:
                leftDrawerOpen && leftDrawerTab === "toc"
                  ? isDarkMode
                    ? "#3a3a4e"
                    : "#e0e0e0"
                  : "transparent",
              borderColor: isDarkMode ? "#444" : "#ddd",
              color: headerTextColor,
            }}
            title="目录"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>

          {/* TTS 朗读 Button */}
          <button
            className={`toc-btn ${isDarkMode ? "dark" : ""}`}
            onClick={ttsOpen ? handleStopTTS : handleStartTTS}
            style={{
              backgroundColor: ttsOpen
                ? isDarkMode
                  ? "#3a3a4e"
                  : "#e0e0e0"
                : "transparent",
              borderColor: isDarkMode ? "#444" : "#ddd",
              color: headerTextColor,
            }}
            title={ttsOpen ? "停止朗读" : "朗读"}
          >
            {ttsOpen ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="6" y="5" width="4" height="14" rx="1"/>
                <rect x="14" y="5" width="4" height="14" rx="1"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            )}
          </button>

          {/* More Menu Button - right first */}
          <button
            className={`more-menu-btn nav-btn-more ${isDarkMode ? "dark" : ""}`}
            onClick={() => setMoreMenuOpen(!moreMenuOpen)}
            style={{
              backgroundColor: moreMenuOpen
                ? isDarkMode
                  ? "#3a3a4e"
                  : "#e0e0e0"
                : "transparent",
              borderColor: isDarkMode ? "#444" : "#ddd",
              color: headerTextColor,
            }}
            title="更多"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="1" />
              <circle cx="19" cy="12" r="1" />
              <circle cx="5" cy="12" r="1" />
            </svg>
          </button>
        </div>
      </header>

      {/* TTS Control Bar */}
      {ttsOpen && (
        <div
          style={{
            backgroundColor: isDarkMode ? "#1a3a2a" : "#ecfdf5",
            borderBottom: `1px solid ${isDarkMode ? "#065f46" : "#a7f3d0"}`,
            padding: "6px 12px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            color: isDarkMode ? "#6ee7b7" : "#065f46",
          }}
        >
          {/* Stop */}
          <button
            onClick={handleStopTTS}
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: "4px", display: "flex", alignItems: "center" }}
            title="停止"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2"/>
            </svg>
          </button>

          {/* Prev sentence */}
          <button
            onClick={handlePrevSentence}
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: "4px", display: "flex", alignItems: "center", opacity: ttsIndexRef.current <= 0 ? 0.3 : 1 }}
            title="上一句"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="5" width="2" height="14" rx="0.5"/>
              <polygon points="18 5 8 12 18 19"/>
            </svg>
          </button>

          {/* Pause / Resume */}
          <button
            onClick={() => { if (ttsIsPlaying) ttsPause(); else ttsResume(); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: "4px", display: "flex", alignItems: "center" }}
            title={ttsIsPlaying ? "暂停" : "继续"}
          >
            {ttsIsPlaying ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1"/>
                <rect x="14" y="4" width="4" height="16" rx="1"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            )}
          </button>

          {/* Next sentence */}
          <button
            onClick={handleNextSentence}
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: "4px", display: "flex", alignItems: "center", opacity: ttsIndexRef.current >= ttsSentencesRef.current.length - 1 ? 0.3 : 1 }}
            title="下一句"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6 5 16 12 6 19"/>
              <rect x="18" y="5" width="2" height="14" rx="0.5"/>
            </svg>
          </button>

          {/* Status */}
          <span style={{ flex: 1, opacity: 0.7, fontSize: "12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {ttsIsPlaying ? "朗读中..." : ttsIsLoading ? "加载中..." : "已暂停"}
          </span>

          {/* Speed dropdown */}
          <select
            value={SPEED_OPTIONS.findIndex(o => o.label === ttsSpeed)}
            onChange={(e) => {
              const idx = Number(e.target.value);
              const opt = SPEED_OPTIONS[idx];
              if (opt) { setTtsSpeed(opt.label); setSpeed(idx); }
            }}
            style={{
              fontSize: "12px",
              padding: "2px 4px",
              borderRadius: "4px",
              border: `1px solid ${isDarkMode ? "#374151" : "#d1d5db"}`,
              background: isDarkMode ? "#1f2937" : "#fff",
              color: "inherit",
              cursor: "pointer",
              minWidth: "56px",
            }}
          >
            {SPEED_OPTIONS.map((opt, idx) => (
              <option key={idx} value={idx}>{opt.label}</option>
            ))}
          </select>

          {/* TTS source toggle */}
          {hasLocalTTS && (
            <select
              value={useLocalTTS ? 'local' : 'remote'}
              onChange={(e) => setTTSSource(e.target.value === 'local')}
              style={{
                fontSize: "11px",
                padding: "2px 4px",
                borderRadius: "4px",
                border: `1px solid ${isDarkMode ? "#374151" : "#d1d5db"}`,
                background: isDarkMode ? "#1f2937" : "#fff",
                color: "inherit",
                cursor: "pointer",
              }}
            >
              <option value="remote">在线语音</option>
              <option value="local">本地语音</option>
            </select>
          )}

          {/* Voice selector (local TTS only) */}
          {useLocalTTS && ttsVoices.length > 1 && (
            <select
              value={ttsVoiceIndex}
              onChange={(e) => ttsSelectVoice(Number(e.target.value))}
              style={{
                fontSize: "11px",
                padding: "2px 4px",
                borderRadius: "4px",
                border: `1px solid ${isDarkMode ? "#374151" : "#d1d5db"}`,
                background: isDarkMode ? "#1f2937" : "#fff",
                color: "inherit",
                maxWidth: "90px",
                cursor: "pointer",
              }}
            >
              {ttsVoices.map((v) => (
                <option key={v.index} value={v.index}>
                  {v.name.replace(/^Microsoft\s+|^Google\s+/, '').split(' ').slice(0, 2).join(' ')}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* More Menu Dropdown */}
      {moreMenuOpen && (
        <>
          <div className="more-menu-overlay" onClick={() => setMoreMenuOpen(false)} />
          <div
            className={`more-menu-dropdown ${isDarkMode ? "dark" : ""}`}
            style={{ backgroundColor: isDarkMode ? "#2a2a3e" : "#ffffff" }}
          >
            {/* Search */}
            <button
              className="more-menu-item"
              onClick={() => {
                setSearchOpen(!searchOpen);
                if (!searchOpen) setTimeout(() => searchInputRef.current?.focus(), 50);
                setMoreMenuOpen(false);
              }}
              style={{ color: isDarkMode ? "#ccc" : "#333" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span>搜索</span>
            </button>

            {/* Bookmark */}
            <button
              className="more-menu-item"
              onClick={() => {
                handleBookmarkClick();
                setMoreMenuOpen(false);
              }}
              style={{ color: isDarkMode ? "#ccc" : "#333" }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill={currentBook?.bookmarks?.some((bm) => bm.page === currentScrollPercent) ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              <span>书签</span>
            </button>

            {/* Settings */}
            <button
              className="more-menu-item"
              onClick={() => {
                setSettingsPanelOpen(!settingsPanelOpen);
                setMoreMenuOpen(false);
              }}
              style={{ color: isDarkMode ? "#ccc" : "#333" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>阅读设置</span>
            </button>

            {/* Vocabulary sidebar */}
            <button
              className="more-menu-item"
              onClick={() => {
                handleSidebarToggle();
                setMoreMenuOpen(false);
              }}
              style={{ color: isDarkMode ? "#ccc" : "#333" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="15" y1="3" x2="15" y2="21" />
              </svg>
              <span>词汇表</span>
            </button>

            {/* Vocab Analysis */}
            <button
              className="more-menu-item"
              onClick={() => {
                setVocabAnalysisOpen(true);
                setMoreMenuOpen(false);
              }}
              style={{ color: isDarkMode ? "#ccc" : "#333" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
              </svg>
              <span>词汇分析</span>
            </button>

            {/* Reading Stats */}
            <button
              className="more-menu-item"
              onClick={() => {
                setReadingStatsOpen(true);
                setMoreMenuOpen(false);
              }}
              style={{ color: isDarkMode ? "#ccc" : "#333" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>阅读统计</span>
            </button>

            {/* Dictionary status */}
            {dictLoadStatus !== "idle" && (
              <div
                className="more-menu-item"
                style={{ color: isDarkMode ? "#888" : "#999", cursor: "default", justifyContent: "flex-start", gap: "8px" }}
              >
                {dictLoadStatus === "loading" && <><span className="dict-status-spinner"></span><span>词典加载中...</span></>}
                {dictLoadStatus === "loaded" && (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>词典已就绪</span>
                  </>
                )}
                {dictLoadStatus === "failed" && (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                    <span>词典加载失败</span>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Search Bar */}
      {searchOpen && (
        <div
          className={`search-bar ${isDarkMode ? "dark" : ""}`}
          style={{
            backgroundColor: isDarkMode ? "#1e1e2e" : "#f8f9fa",
            borderBottomColor: isDarkMode ? "#333" : "#e0e0e0",
          }}
        >
          <div className="search-container">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchInput}
              placeholder="搜索全文..."
              className={`search-input ${isDarkMode ? "dark" : ""}`}
              style={{
                backgroundColor: isDarkMode ? "#2a2a3e" : "#fff",
                color: isDarkMode ? "#ccc" : "#333",
                borderColor: isDarkMode ? "#444" : "#ddd",
              }}
            />
            <div className="search-results-count" style={{ color: isDarkMode ? "#999" : "#666" }}>
              {searchResults.length > 0 ? (
                <>第 {currentSearchIndex + 1} / {searchResults.length} 个匹配</>
              ) : (
                searchQuery ? "无匹配" : ""
              )}
            </div>
            <button
              className={`search-nav-btn ${isDarkMode ? "dark" : ""}`}
              onClick={goToPrevSearchResult}
              disabled={searchResults.length === 0}
              title="上一个 (Shift+Enter)"
              style={{ color: headerTextColor }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>
            <button
              className={`search-nav-btn ${isDarkMode ? "dark" : ""}`}
              onClick={goToNextSearchResult}
              disabled={searchResults.length === 0}
              title="下一个 (Enter)"
              style={{ color: headerTextColor }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            <button
              className={`search-close-btn ${isDarkMode ? "dark" : ""}`}
              onClick={closeSearch}
              title="关闭 (ESC)"
              style={{ color: headerTextColor }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="main-content" style={{ backgroundColor }}>
        <div ref={containerRef} className="reading-container">
          {loading ? (
            <div className="reading-loading-fullscreen" style={{ backgroundColor }}>
              <div className="loading-spinner"></div>
              <div style={{ color: isDarkMode ? "#aaa" : "#666", fontSize: "14px" }}>正在处理文本...</div>
            </div>
          ) : (
            <ReadingArea
              ref={readingAreaRef}
              text={text}
              processedContent={processedContent}
              annotations={mergedAnnotationsForRender}
              onWordClick={handleWordClick}
              onWordDoubleClick={handleWordDoubleClick}
              getWordAnnotation={getWordAnnotation}
              isClickable={isClickable}
              fontSize={fontSize}
              lineHeight={lineHeight}
              textColor={textColor}
              backgroundColor={backgroundColor}
              annotationColor={annotationColor}
              annotationFontSize={annotationFontSize}
              annotationDisplayMode={annotationDisplayMode}
              highlightBg={highlightBg}
              highlightBgHover={highlightBgHover}
              isDarkMode={isDarkMode}
              cefrColorPalette={cefrColorPalette}
              headerVisible={true}
              searchQuery={searchQuery}
              searchResults={searchResults}
              currentSearchIndex={currentSearchIndex}
              bookId={currentBook?.id || ""}
              onProgressChange={(percent) => {
                setCurrentScrollPercent(percent);
              }}
              onParagraphIndexChange={(index, offsetRatio) => {
                setCurrentParagraphIndex(index);
                setCurrentParagraphOffsetRatio(offsetRatio);
                if (processedContent && index >= 0 && index < processedContent.length) {
                  const paraText = processedContent[index].segments.map((s) => s.text).join("").substring(0, 80);
                  setCurrentParagraphText(paraText);
                }
                if (currentBook?.tableOfContents && currentBook.tableOfContents.length > 0) {
                  let chapterName = "";
                  for (let i = currentBook.tableOfContents.length - 1; i >= 0; i--) {
                    const toc = currentBook.tableOfContents[i];
                    if (toc.paragraphIndex !== undefined && toc.paragraphIndex <= index) {
                      chapterName = toc.title;
                      break;
                    }
                  }
                  setCurrentChapterTitle(chapterName);
                }
              }}
              initialParagraphIndex={currentBook?.lastParagraphIndex ?? -1}
              initialParagraphText={currentBook?.lastParagraphText || ""}
              initialParagraphOffsetRatio={currentBook?.lastParagraphOffsetRatio ?? 0}
              initialScrollPercent={currentBook?.lastScrollPosition || 0}
              pageTurnRatio={pageTurnRatio}
              onTextSelect={handleTextSelect}
              sentenceAnnotations={currentBook?.sentenceAnnotations || []}
              onRemoveSentenceAnnotation={handleRemoveSentenceAnnotation}
              onRemoveAnnotation={removeAnnotation}
              clickToTurnPage={clickToTurnPage}
              ttsSentenceId={ttsCurrentSentenceId}
              ttsPlaying={ttsOpen}
              fontFamilyCss={fontFamilyCss}
            />
          )}
        </div>

        {/* Sidebar */}
        <VocabularySidebar
          annotations={sidebarAnnotations}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onClearAll={clearAllAnnotations}
          onWordClick={scrollToWord}
          onRemoveWord={removeAnnotation}
          sentenceAnnotations={currentBook?.sentenceAnnotations ?? []}
          onSentenceClick={scrollToSentence}
          onRemoveSentence={handleRemoveSentenceAnnotation}
          masteredVocabulary={masteredVocabulary}
          onRestoreMastered={restoreFromMastered}
          onRemoveMastered={removeFromMastered}
          dictMode={dictMode}
          isDarkMode={isDarkMode}
          sidebarBg={sidebarBg}
          headerBg={headerBg}
          textColor={textColor}
          annotationColor={annotationColor}
          highlightBg={isDarkMode ? "#2a2a3e" : "#f8f9fa"}
        />
      </main>

      {/* Word Tooltip */}
      {selectedWord && (
        <WordTooltip
          word={selectedWord.word}
          lemma={selectedWord.lemma}
          position={selectedWord.position}
          onAnnotateAll={annotateAll}
          onRemoveAnnotation={() =>
            removeAnnotation(selectedWord.word, selectedWord.lemma)
          }
          onClose={closeTooltip}
          isAnnotated={
            !!resolveAnnotation(
              mergedAnnotationsForRender,
              selectedWord.word,
              selectedWord.lemma,
            )
          }
          annotation={
            resolveAnnotation(
              mergedAnnotationsForRender,
              selectedWord.word,
              selectedWord.lemma,
            ) ?? null
          }
          dictMode={dictMode}
          isDarkMode={isDarkMode}
          textColor={textColor}
          accentColor={annotationColor}
          onOnlineLookup={lookupOnlineWord}
        />
      )}

      {/* 句子标注浮窗 */}
      {pendingSelection && (
        <>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
            }}
            onClick={closePendingSelection}
          />
          <div
            style={{
              position: "fixed",
              left: Math.max(
                10,
                Math.min(
                  pendingSelection.position.x - 100,
                  typeof window !== "undefined" ? window.innerWidth - 260 : 300
                )
              ),
              top: Math.max(10, pendingSelection.position.y - 50),
              zIndex: 1000,
              backgroundColor: isDarkMode ? "#2a2a3e" : "#ffffff",
              borderRadius: "8px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
              padding: "10px 14px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              minWidth: showNoteInput ? "240px" : undefined,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                onClick={handleTranslateSentence}
                disabled={translatingSelection || showNoteInput}
                style={{
                  background: isDarkMode ? noteInputColors.dark.bg : noteInputColors.light.bg,
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 14px",
                  fontSize: "13px",
                  cursor: translatingSelection ? "wait" : "pointer",
                  opacity: (translatingSelection || showNoteInput) ? 0.7 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {translatingSelection ? "翻译中..." : "翻译标注"}
              </button>
              <button
                onClick={() => setShowNoteInput(true)}
                disabled={translatingSelection || showNoteInput}
                style={{
                  background: isDarkMode ? noteInputColors.noteBtn.dark : noteInputColors.noteBtn.light,
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 14px",
                  fontSize: "13px",
                  cursor: "pointer",
                  opacity: (translatingSelection || showNoteInput) ? 0.7 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                添加笔记
              </button>
              <button
                onClick={closePendingSelection}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px",
                  color: isDarkMode ? "#888" : "#999",
                  fontSize: "16px",
                  lineHeight: 1,
                }}
              >
                x
              </button>
            </div>
            {showNoteInput && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <textarea
                  ref={noteInputRef}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="输入笔记内容..."
                  style={{
                    width: "100%",
                    minHeight: "60px",
                    padding: "8px",
                    borderRadius: "6px",
                    border: `1px solid ${isDarkMode ? "#555" : "#ddd"}`,
                    backgroundColor: isDarkMode ? "#1e1e2e" : "#fff",
                    color: isDarkMode ? "#ddd" : "#333",
                    fontSize: "13px",
                    lineHeight: "1.5",
                    resize: "vertical",
                    outline: "none",
                    fontFamily: "inherit",
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (noteText.trim()) {
                        handleAddNote(noteText);
                        setShowNoteInput(false);
                        setNoteText("");
                      }
                    }
                  }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                  <button
                    onClick={() => { setShowNoteInput(false); setNoteText(""); }}
                    style={{
                      background: "none",
                      border: `1px solid ${isDarkMode ? "#555" : "#ddd"}`,
                      borderRadius: "4px",
                      padding: "4px 12px",
                      fontSize: "12px",
                      color: isDarkMode ? "#aaa" : "#666",
                      cursor: "pointer",
                    }}
                  >
                    取消
                  </button>
                  <button
                    onClick={() => {
                      if (noteText.trim()) {
                        handleAddNote(noteText);
                        setShowNoteInput(false);
                        setNoteText("");
                      }
                    }}
                    disabled={!noteText.trim()}
                    style={{
                      background: isDarkMode ? noteInputColors.noteBtn.dark : noteInputColors.noteBtn.light,
                      color: "#fff",
                      border: "none",
                      borderRadius: "4px",
                      padding: "4px 12px",
                      fontSize: "12px",
                      cursor: noteText.trim() ? "pointer" : "not-allowed",
                      opacity: noteText.trim() ? 1 : 0.5,
                    }}
                  >
                    确定
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <style jsx>{`
        .app-container {
          min-height: 100dvh;
          height: 100dvh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .app-header {
          position: sticky;
          top: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 24px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          flex-shrink: 0;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 16px;
          flex: 1;
          min-width: 0;
        }

        .back-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 8px 12px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
        }

        .back-btn:hover {
          filter: brightness(0.95);
        }

        .search-btn,
        .toc-btn,
        .more-menu-btn,
        .settings-btn,
        .bookmark-btn,
        .sidebar-toggle {
          padding: 8px 12px;
          border: 1px solid;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
        }

        .search-btn:hover,
        .toc-btn:hover,
        .more-menu-btn:hover,
        .settings-btn:hover,
        .bookmark-btn:hover,
        .sidebar-toggle:hover {
          filter: brightness(0.95);
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }

        .search-bar {
          border-bottom: 1px solid;
          padding: 12px 20px;
          animation: slideDown 0.2s ease;
        }

        .search-container {
          display: flex;
          align-items: center;
          gap: 12px;
          max-width: 600px;
          margin: 0 auto;
        }

        .search-input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid;
          border-radius: 6px;
          font-size: 14px;
          outline: none;
        }

        .search-input:focus {
          border-color: #8898A8;
        }

        .search-results-count {
          font-size: 14px;
          min-width: 80px;
          text-align: center;
        }

        .search-nav-btn,
        .search-close-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px 8px;
          display: flex;
          align-items: center;
          border-radius: 4px;
          transition: opacity 0.15s;
        }

        .search-nav-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .search-close-btn:hover,
        .search-nav-btn:hover {
          opacity: 0.7;
        }

        .main-content {
          flex: 1;
          min-height: 0;
          overflow: hidden;
          position: relative;
          display: flex;
          flex-direction: column;
        }

        /* 仅外层包裹，滚动只发生在 ReadingArea 内部，避免双滚动条 */
        .reading-container {
          flex: 1;
          min-height: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .reading-loading-fullscreen {
          flex: 1;
          min-height: 0;
          height: 100%;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e0e0e0;
          border-top-color: #8898A8;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes slideDown {
          from { transform: translateY(-8px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        /* Left Drawer */
        .left-drawer-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.3);
          z-index: 150;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s ease;
        }

        .left-drawer-overlay.open {
          opacity: 1;
          pointer-events: auto;
        }

        .left-drawer {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: 280px;
          max-width: 80%;
          z-index: 160;
          display: flex;
          flex-direction: column;
          transform: translateX(-100%);
          transition: transform 0.3s ease;
          box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
        }

        .left-drawer.open {
          transform: translateX(0);
        }

        .left-drawer-header {
          display: flex;
          align-items: center;
          border-bottom: 1px solid;
          padding: 12px 16px;
        }

        .left-drawer-tabs {
          display: flex;
          flex: 1;
          gap: 4px;
        }

        .drawer-tab {
          background: none;
          border: none;
          padding: 8px 12px;
          font-size: 14px;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.15s;
        }

        .drawer-close {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
        }

        .left-drawer-content {
          flex: 1;
          overflow-y: auto;
          padding-bottom: 8px;
        }

        .toc-list {
          display: flex;
          flex-direction: column;
        }

        .toc-item {
          padding: 10px 16px;
          text-align: left;
          border: none;
          background: transparent;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.15s;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .toc-item:hover {
          opacity: 0.8;
        }

        .toc-scroll-bottom-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: calc(100% - 32px);
          margin: 8px 16px;
          padding: 8px;
          border: 1px solid;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
        }

        .empty-message {
          text-align: center;
          padding: 40px 20px;
          font-size: 14px;
        }

        .bookmark-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 8px 16px;
        }

        .add-bookmark-btn {
          border: none;
          border-radius: 6px;
          padding: 10px;
          font-size: 14px;
          cursor: pointer;
          width: 100%;
        }

        .bookmark-item {
          display: flex;
          align-items: center;
          border-radius: 6px;
          overflow: hidden;
        }

        .bookmark-page {
          flex: 1;
          padding: 10px 12px;
          border: none;
          background: transparent;
          font-size: 14px;
          cursor: pointer;
          text-align: left;
        }

        .bookmark-delete {
          padding: 10px 12px;
          border: none;
          background: transparent;
          cursor: pointer;
          display: flex;
          align-items: center;
        }

        /* More Menu */
        .more-menu-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 98;
        }

        .more-menu-dropdown {
          position: fixed;
          top: 50px;
          right: 12px;
          width: 150px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 101;
          overflow: hidden;
          animation: fadeIn 0.15s ease;
        }

        .more-menu-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 12px 16px;
          border: none;
          background: transparent;
          font-size: 14px;
          cursor: pointer;
          text-align: left;
          transition: background 0.15s ease;
        }

        .more-menu-item:hover {
          background: rgba(0, 0, 0, 0.05);
        }

        .more-menu-dropdown.dark .more-menu-item:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .more-menu-item span {
          flex: 1;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Dict status */
        .dict-status {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          padding: 4px 8px;
          border-radius: 4px;
        }

        .dict-status-loading {
          color: #666;
        }

        .dict-status-loaded {
          color: #4CAF50;
        }

        .dict-status-failed {
          color: #e74c3c;
        }

        .dict-status-spinner {
          width: 12px;
          height: 12px;
          border: 2px solid #e0e0e0;
          border-top-color: #8898A8;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes topBarSlide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}
