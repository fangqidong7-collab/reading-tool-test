"use client";

import React from "react";
import { ReadingArea, type ReadingAreaRef } from "@/components/ReadingArea";
import { WordTooltip } from "@/components/WordTooltip";
import { VocabularySidebar } from "@/components/VocabularySidebar";
import { SettingsPanel } from "@/components/SettingsPanel";
import { SyncPanel } from "@/components/SyncPanel";
import type { Book, ProcessedContent, SentenceAnnotation } from "@/hooks/useBookshelf";
interface AnnotatedWord {
  root: string;
  meaning: string;
  pos: string;
  count: number;
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
  dictMode: "zh" | "en";
  pageTurnRatio: number;
  clickToTurnPage: boolean;
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
  setDictMode: (mode: "zh" | "en") => void;
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
}

const noteInputColors = {
  light: { bg: "#4a90d9", text: "#fff" },
  dark: { bg: "#6ba3e0", text: "#fff" },
  noteBtn: { light: "#3498db", dark: "#2980b9" },
};

export function ReadingHomeView(props: ReadingHomeViewProps) {
  const {
    containerRef,
    readingAreaRef,
    currentBook,
    processedContent,
    annotations,
    mergedAnnotationsForRender,
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
  } = props;

  const [showNoteInput, setShowNoteInput] = React.useState(false);
  const [noteText, setNoteText] = React.useState("");
  const noteInputRef = React.useRef<HTMLTextAreaElement>(null);

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
                      ? "#6ba3e0"
                      : "#4a90d9"
                    : isDarkMode
                      ? "#888"
                      : "#666",
                borderBottomColor:
                  leftDrawerTab === "toc"
                    ? isDarkMode
                      ? "#6ba3e0"
                      : "#4a90d9"
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
                      ? "#6ba3e0"
                      : "#4a90d9"
                    : isDarkMode
                      ? "#888"
                      : "#666",
                borderBottomColor:
                  leftDrawerTab === "bookmarks"
                    ? isDarkMode
                      ? "#6ba3e0"
                      : "#4a90d9"
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
                      padding: "8px 12px",
                      borderBottom: `1px solid ${isDarkMode ? "#333" : "#eee"}`,
                    }}
                  >
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
                              ? "#6ba3e0"
                              : "#4a90d9"
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
                  {currentBook?.tableOfContents && currentBook.tableOfContents.length > 10 && (
                    <button
                      className="toc-scroll-bottom-btn"
                      onClick={() => {
                        const container = tocScrollContainerRef.current;
                        if (container) {
                          container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
                        }
                      }}
                      style={{
                        color: isDarkMode ? "#6ba3e0" : "#4a90d9",
                        borderColor: isDarkMode ? "#444" : "#ddd",
                        backgroundColor: isDarkMode ? "#2a2a3e" : "#f8f9fa",
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="7 13 12 18 17 13" />
                        <polyline points="7 6 12 11 17 6" />
                      </svg>
                      到底部
                    </button>
                  )}
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
                      color: isDarkMode ? "#6ba3e0" : "#4a90d9",
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
                      color: isDarkMode ? "#6ba3e0" : "#4a90d9",
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
              background: "linear-gradient(90deg, #4a90d9, #6ba3e0, #4a90d9)",
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
              <span>字体设置</span>
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
              highlightBg={highlightBg}
              highlightBgHover={highlightBgHover}
              isDarkMode={isDarkMode}
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
            />
          )}
        </div>

        {/* Sidebar */}
        <VocabularySidebar
          annotations={mergedAnnotationsForRender}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onClearAll={clearAllAnnotations}
          onWordClick={scrollToWord}
          onRemoveWord={removeAnnotation}
          sentenceAnnotations={currentBook?.sentenceAnnotations ?? []}
          onSentenceClick={scrollToSentence}
          onRemoveSentence={handleRemoveSentenceAnnotation}
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
          isAnnotated={!!mergedAnnotationsForRender[selectedWord.lemma]}
          annotation={mergedAnnotationsForRender[selectedWord.lemma] ?? null}
          dictMode={dictMode}
          isDarkMode={isDarkMode}
          textColor={textColor}
          accentColor={annotationColor}
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
          border-color: #4a90d9;
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
          overflow: hidden;
          position: relative;
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
          border-top-color: #4a90d9;
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
          padding: 8px 0;
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
          border-top-color: #4a90d9;
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
