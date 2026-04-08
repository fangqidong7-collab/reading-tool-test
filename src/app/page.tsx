"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Bookshelf } from "@/components/Bookshelf";
import { ReadingArea } from "@/components/ReadingArea";
import { WordTooltip } from "@/components/WordTooltip";
import { VocabularySidebar } from "@/components/VocabularySidebar";
import { SettingsPanel } from "@/components/SettingsPanel";
import { useBookshelf, ProcessedContent, ProcessedSegment } from "@/hooks/useBookshelf";
import { useReadingSettings } from "@/hooks/useReadingSettings";
import { lemmatize, getWordMeaning, findWordFamily } from "@/lib/dictionary";
import { translateWord } from "@/lib/translate";
import { forceReloadDictionary, lookupExternalDict, type DictLoadStatus } from "@/lib/dictLoader";

/**
 * Clean translation text - remove parts of speech and extra info
 */
function cleanTranslation(text: string): string {
  if (!text) return "";
  
  let cleaned = text;
  
  // Remove leading parts of speech like "n. " "v. " "adj. " etc.
  // Common patterns: "n.", "v.", "adj.", "adv.", "prep.", "conj.", "pron.", "det.", "vi.", "vt.", "n.v.", etc.
  cleaned = cleaned.replace(/^[a-z]+\.(?:\/[a-z]+\.)*\s*/gi, '');
  
  // Remove leading Chinese parts of speech
  cleaned = cleaned.replace(/^(名词|动词|形容词|副词|介词|连词|代词|冠词|感叹词|数词|前缀|后缀)[;；\s]*/g, '');
  
  // Remove leading dots and colons
  cleaned = cleaned.replace(/^[.。:：]+/, '');
  
  // Remove content in brackets like [计], [军], etc.
  cleaned = cleaned.replace(/\[[^\]]+\]/g, '');
  
  // Remove multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  // Remove leading/trailing punctuation that might be left
  cleaned = cleaned.replace(/^[，。、；：.!?,]+/, '').replace(/[，。、；：.!?,]+$/, '');
  
  return cleaned.trim();
}

// Process text into structured segments with lemmas
function processTextToSegments(text: string): ProcessedContent {
  const paragraphs = text.split(/\n\n+/);
  return paragraphs.map((paragraph) => {
    const segments: ProcessedSegment[] = [];
    const regex = /([a-zA-Z]+|[^a-zA-Z\s]+|\s+)/g;
    let match;
    
    while ((match = regex.exec(paragraph)) !== null) {
      const token = match[0];
      if (/^\s+$/.test(token)) {
        segments.push({ text: token, lemma: "", type: "space" });
      } else if (/^[a-zA-Z]+$/.test(token)) {
        segments.push({ text: token, lemma: lemmatize(token.toLowerCase()), type: "word" });
      } else {
        segments.push({ text: token, lemma: "", type: "punctuation" });
      }
    }
    
    return segments;
  });
}

export default function Home() {
  const {
    books,
    currentBook,
    isLoaded,
    getProgress,
    formatLastRead,
    addBook,
    deleteBook,
    updateBookAnnotations,
    updateScrollPosition,
    updateReadPage,
    saveProcessedContent,
    openBook,
    closeBook,
    addBookmark,
    removeBookmark,
  } = useBookshelf();

  // Reading settings
  const {
    isLoaded: settingsLoaded,
    fontSize,
    lineHeight,
    backgroundColor,
    textColor,
    headerBg,
    headerTextColor,
    annotationColor,
    annotationFontSize,
    highlightBg,
    highlightBgHover,
    sidebarBg,
    isDarkMode,
    currentTheme,
    setFontSize,
    setLineHeight,
    setBackgroundTheme,
    getSidebarState,
    setSidebarState,
    resetToDefault,
  } = useReadingSettings();

  // Reading state
  const [text, setText] = useState<string>("");
  const [processedContent, setProcessedContent] = useState<ProcessedContent | null>(null);
  const [annotations, setAnnotations] = useState<
    Record<string, { root: string; meaning: string; pos: string; count: number }>
  >({});
  const [selectedWord, setSelectedWord] = useState<{
    word: string;
    position: { x: number; y: number };
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [leftDrawerTab, setLeftDrawerTab] = useState<'toc' | 'bookmarks'>('toc');
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Pagination state - managed by ReadingArea internally
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPagesState, setTotalPagesState] = useState(1);
  
  // Ref to track if we're currently in a programmatic scroll
  const isProgrammaticScrollRef = useRef(false);
  
  // Store current book data in refs to avoid dependency issues
  const currentBookIdRef = useRef<string | null>(null);
  const currentBookContentRef = useRef<string>("");
  const currentBookAnnotationsRef = useRef<
    Record<string, { root: string; meaning: string; pos: string; count: number }>
  >({});

  // Dictionary loading status
  const [dictLoadStatus, setDictLoadStatus] = useState<DictLoadStatus>('idle');
  const dictStatusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load external dictionary on mount (force reload to get latest dict.json)
  useEffect(() => {
    forceReloadDictionary().then((status) => {
      setDictLoadStatus(status);
      
      // Auto-dismiss status after 3 seconds
      if (dictStatusTimeoutRef.current) {
        clearTimeout(dictStatusTimeoutRef.current);
      }
      dictStatusTimeoutRef.current = setTimeout(() => {
        setDictLoadStatus('idle');
      }, 3000);
    });
    
    return () => {
      if (dictStatusTimeoutRef.current) {
        clearTimeout(dictStatusTimeoutRef.current);
      }
    };
  }, []);

  // Sync refs when currentBook changes
  useEffect(() => {
    if (currentBook) {
      currentBookIdRef.current = currentBook.id;
      // Only update if content actually changed
      if (currentBookContentRef.current !== currentBook.content) {
        currentBookContentRef.current = currentBook.content;
        setText(currentBook.content);
      }
      // Only update if annotations actually changed
      if (JSON.stringify(currentBookAnnotationsRef.current) !== JSON.stringify(currentBook.annotations)) {
        currentBookAnnotationsRef.current = currentBook.annotations;
        setAnnotations(currentBook.annotations);
      }
      
      // Process content
      let processed = currentBook.processedContent;
      if (!processed) {
        processed = processTextToSegments(currentBook.content);
        setProcessedContent(processed);
        saveProcessedContent(currentBook.id, processed);
      } else {
        setProcessedContent(processed);
      }
      
      // Restore last read page (default to page 1)
      const savedPage = currentBook.lastReadPage || 1;
      setCurrentPage(Math.min(savedPage, Math.max(1, processed?.length || 1)));
      
      // Restore sidebar state from localStorage (default closed)
      const savedSidebarState = getSidebarState(currentBook.id);
      setSidebarOpen(savedSidebarState);
      
    } else {
      currentBookIdRef.current = null;
      currentBookContentRef.current = "";
      currentBookAnnotationsRef.current = {};
      setProcessedContent(null);
      setCurrentPage(1);
      setSidebarOpen(false);
    }
  }, [currentBook, saveProcessedContent, getSidebarState]);

  // Handle sidebar toggle with localStorage memory
  const handleSidebarToggle = useCallback(() => {
    const newState = !sidebarOpen;
    setSidebarOpen(newState);
    const bookId = currentBookIdRef.current;
    if (bookId) {
      setSidebarState(bookId, newState);
    }
  }, [sidebarOpen, setSidebarState]);

  // Handle TOC button click
  const handleTocClick = useCallback(() => {
    setLeftDrawerTab('toc');
    setLeftDrawerOpen(true);
  }, []);

  // Handle bookmark button click
  const handleBookmarkClick = useCallback(() => {
    setLeftDrawerTab('bookmarks');
    setLeftDrawerOpen(true);
  }, []);

  // Toggle bookmark for current page
  const toggleCurrentBookmark = useCallback(() => {
    const bookId = currentBookIdRef.current;
    if (!bookId || !currentBook) return;
    
    const bookmarks = currentBook.bookmarks || [];
    const hasBookmark = bookmarks.some((bm) => bm.page === currentPage);
    
    if (hasBookmark) {
      const bookmark = bookmarks.find((bm) => bm.page === currentPage);
      if (bookmark) {
        removeBookmark(bookId, bookmark.id);
      }
    } else {
      addBookmark(bookId, currentPage);
    }
  }, [currentBook, currentPage, addBookmark, removeBookmark]);

  // Save annotations when they change
  useEffect(() => {
    const bookId = currentBookIdRef.current;
    if (bookId) {
      updateBookAnnotations(bookId, annotations);
    }
  }, [annotations, updateBookAnnotations]);

  // Handle scroll - save position with debounce, only for user scrolls
  useEffect(() => {
    if (!currentBook) return;

    const handleScroll = () => {
      // Skip if this is a programmatic scroll
      if (isProgrammaticScrollRef.current) return;
      
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        const bookId = currentBookIdRef.current;
        if (bookId) {
          updateScrollPosition(bookId, window.scrollY);
        }
      }, 500);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [currentBook, updateScrollPosition]);

  // Handle word click
  const handleWordClick = useCallback(
    async (word: string, event: React.MouseEvent) => {
      const cleanWord = word.toLowerCase().trim();
      if (!cleanWord) return;

      const rect = (event.target as HTMLElement).getBoundingClientRect();
      setSelectedWord({
        word: cleanWord,
        position: {
          x: rect.left + rect.width / 2,
          y: rect.top - 10,
        },
      });
    },
    []
  );

  // Annotate all occurrences of a word
  const annotateAll = useCallback(
    async (word: string) => {
      const cleanWord = word.toLowerCase().trim();
      const root = lemmatize(cleanWord);

      if (annotations[root]) {
        return;
      }

      setLoading(true);

      try {
        let rawMeaning = "";

        // 1. 先查内置词典
        const entry = getWordMeaning(root);
        if (entry?.meaning) {
          rawMeaning = entry.meaning;
        }

        // 2. 查外部词典（带智能后缀去除）
        if (!rawMeaning) {
          const extMeaning = lookupExternalDict(cleanWord);
          if (extMeaning) {
            rawMeaning = extMeaning;
          }
        }

        // 3. 最后才调用AI翻译
        if (!rawMeaning) {
          rawMeaning = await translateWord(root);
        }

        // 清洗释义，去除词性标注
        const meaning = cleanTranslation(rawMeaning);
        const family = findWordFamily(root, text);

        setAnnotations((prev) => ({
          ...prev,
          [root]: {
            root,
            meaning,
            pos: "",
            count: family.length,
          },
        }));
      } catch (err) {
        console.error("Annotation error:", err);
      } finally {
        setLoading(false);
        setSelectedWord(null);
      }
    },
    [annotations, text]
  );

  // Remove annotation
  const removeAnnotation = useCallback((word: string) => {
    const root = lemmatize(word.toLowerCase());
    setAnnotations((prev) => {
      const next = { ...prev };
      delete next[root];
      return next;
    });
    setSelectedWord(null);
  }, []);

  // Clear all annotations
  const clearAllAnnotations = useCallback(() => {
    setAnnotations({});
  }, []);

  // Close tooltip
  const closeTooltip = useCallback(() => {
    setSelectedWord(null);
  }, []);

  // Scroll to word in text
  const scrollToWord = useCallback((word: string) => {
    const root = lemmatize(word.toLowerCase());
    const elements = containerRef.current?.querySelectorAll(
      `[data-root="${root}"]`
    );
    if (elements && elements.length > 0) {
      isProgrammaticScrollRef.current = true;
      (elements[0] as HTMLElement).scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 500);
    }
  }, []);

  // Get word annotation
  const getWordAnnotation = useCallback(
    (word: string) => {
      const root = lemmatize(word.toLowerCase());
      return annotations[root] || null;
    },
    [annotations]
  );

  // Check if word is clickable
  const isClickable = useCallback((word: string) => {
    return /^[a-zA-Z]+$/.test(word);
  }, []);

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    const bookId = currentBookIdRef.current;
    if (bookId) {
      updateReadPage(bookId, page);
    }
    setCurrentPage(page);
    // Scroll to top of reading area
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [updateReadPage]);

  // Go to page from TOC or bookmark
  const goToPage = useCallback((page: number) => {
    handlePageChange(page);
    setLeftDrawerOpen(false);
  }, [handlePageChange]);

  // Handle return to bookshelf
  const handleReturnToBookshelf = useCallback(() => {
    isProgrammaticScrollRef.current = true;
    closeBook();
    setText("");
    setAnnotations({});
    setSelectedWord(null);
    setProcessedContent(null);
    setCurrentPage(1);
    setSettingsPanelOpen(false);
  }, [closeBook]);

  // Show loading while initializing
  if (!isLoaded || !settingsLoaded) {
    return (
      <div className="loading-screen" style={{ backgroundColor }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  // Bookshelf view (when no book is open)
  if (!currentBook) {
    return (
      <div className="bookshelf-page" style={{ backgroundColor }}>
        <Bookshelf
          books={books}
          getProgress={getProgress}
          formatLastRead={formatLastRead}
          onAddBook={addBook}
          onDeleteBook={deleteBook}
          onOpenBook={openBook}
        />
        <style jsx>{`
          .bookshelf-page {
            min-height: 100vh;
          }
          .loading-screen {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
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
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  // Reading view
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
      />

      {/* Left Drawer - TOC and Bookmarks */}
      <div className={`left-drawer-overlay ${leftDrawerOpen ? 'open' : ''}`} onClick={() => setLeftDrawerOpen(false)} />
      <div className={`left-drawer ${leftDrawerOpen ? 'open' : ''}`} style={{ backgroundColor: isDarkMode ? "#1e1e2e" : "#ffffff" }}>
        <div className="left-drawer-header" style={{ borderBottomColor: isDarkMode ? "#333" : "#e0e0e0" }}>
          <div className="left-drawer-tabs">
            <button
              className={`drawer-tab ${leftDrawerTab === 'toc' ? 'active' : ''}`}
              onClick={() => setLeftDrawerTab('toc')}
              style={{ 
                color: leftDrawerTab === 'toc' ? (isDarkMode ? "#6ba3e0" : "#4a90d9") : (isDarkMode ? "#888" : "#666"),
                borderBottomColor: leftDrawerTab === 'toc' ? (isDarkMode ? "#6ba3e0" : "#4a90d9") : "transparent",
              }}
            >
              目录
            </button>
            <button
              className={`drawer-tab ${leftDrawerTab === 'bookmarks' ? 'active' : ''}`}
              onClick={() => setLeftDrawerTab('bookmarks')}
              style={{ 
                color: leftDrawerTab === 'bookmarks' ? (isDarkMode ? "#6ba3e0" : "#4a90d9") : (isDarkMode ? "#888" : "#666"),
                borderBottomColor: leftDrawerTab === 'bookmarks' ? (isDarkMode ? "#6ba3e0" : "#4a90d9") : "transparent",
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
        
        <div className="left-drawer-content">
          {/* TOC Tab */}
          {leftDrawerTab === 'toc' && (
            <div className="toc-list">
              {currentBook?.tableOfContents && currentBook.tableOfContents.length > 0 ? (
                currentBook.tableOfContents.map((entry, index) => (
                  <button
                    key={index}
                    className="toc-item"
                    onClick={() => goToPage(entry.page)}
                    style={{ color: isDarkMode ? "#ccc" : "#333" }}
                  >
                    {entry.title}
                  </button>
                ))
              ) : (
                <div className="empty-message" style={{ color: isDarkMode ? "#666" : "#999" }}>
                  {currentBook?.isSample ? "示例书籍暂无目录" : "暂无目录信息"}
                </div>
              )}
            </div>
          )}
          
          {/* Bookmarks Tab */}
          {leftDrawerTab === 'bookmarks' && (
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
                    {currentBook.bookmarks.some(bm => bm.page === currentPage) ? "移除当前页书签" : "添加当前页书签"}
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
                          onClick={() => goToPage(bookmark.page)}
                          style={{ color: isDarkMode ? "#ccc" : "#333" }}
                        >
                          第 {bookmark.page} 页
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
                    ))
                  }
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
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          
          {/* TOC Button */}
          <button 
            className={`toc-btn ${isDarkMode ? 'dark' : ''}`}
            onClick={handleTocClick}
            style={{ 
              backgroundColor: leftDrawerOpen && leftDrawerTab === 'toc' ? (isDarkMode ? "#3a3a4e" : "#e0e0e0") : "transparent",
              borderColor: isDarkMode ? "#444" : "#ddd",
              color: headerTextColor,
            }}
            title="目录"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
          
          <h1 className="app-title" title={currentBook.title} style={{ color: headerTextColor }}>
            {currentBook.title}
          </h1>
        </div>
        
        <div className="header-center">
          <span className="page-display" style={{ color: headerTextColor }}>
            第 {currentPage} / {totalPagesState} 页
          </span>
        </div>
        
        <div className="header-right">
          {/* Bookmark Button */}
          <button
            className={`bookmark-btn ${isDarkMode ? 'dark' : ''}`}
            onClick={handleBookmarkClick}
            title="书签"
            style={{ 
              backgroundColor: leftDrawerOpen && leftDrawerTab === 'bookmarks' ? (isDarkMode ? "#3a3a4e" : "#e0e0e0") : "transparent",
              borderColor: isDarkMode ? "#444" : "#ddd",
              color: headerTextColor,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill={currentBook?.bookmarks?.some(bm => bm.page === currentPage) ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </button>

          {/* Settings Button */}
          <button
            className="settings-btn"
            onClick={() => setSettingsPanelOpen(!settingsPanelOpen)}
            title="阅读设置"
            style={{ 
              backgroundColor: settingsPanelOpen ? (isDarkMode ? "#3a3a4e" : "#e0e0e0") : "transparent",
              borderColor: isDarkMode ? "#444" : "#ddd",
              color: headerTextColor,
            }}
          >
            <span style={{ fontSize: "14px", fontWeight: "bold" }}>Aa</span>
          </button>

          {/* Dictionary Loading Status */}
          {dictLoadStatus !== 'idle' && (
            <div className={`dict-status dict-status-${dictLoadStatus}`}>
              {dictLoadStatus === 'loading' && (
                <>
                  <span className="dict-status-spinner"></span>
                  <span>词典加载中...</span>
                </>
              )}
              {dictLoadStatus === 'loaded' && (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>词典已就绪</span>
                </>
              )}
              {dictLoadStatus === 'failed' && (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  <span>词典加载失败</span>
                </>
              )}
            </div>
          )}
          <div className="header-stats" style={{ color: isDarkMode ? "#999" : "#666" }}>
            <span className="stat">
              词汇: <strong style={{ color: isDarkMode ? "#6ba3e0" : "#4a90d9" }}>
                {Object.keys(annotations).length}
              </strong>
            </span>
          </div>
          <button
            className={`sidebar-toggle ${isDarkMode ? "dark" : ""}`}
            onClick={handleSidebarToggle}
            title={sidebarOpen ? "收起词汇表" : "展开词汇表"}
            style={{ 
              backgroundColor: sidebarOpen ? (isDarkMode ? "#3a3a4e" : "#e0e0e0") : "transparent",
              borderColor: isDarkMode ? "#444" : "#ddd",
              color: headerTextColor,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="15" y1="3" x2="15" y2="21" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content" style={{ backgroundColor }}>
        <div ref={containerRef} className="reading-container">
          <ReadingArea
            text={text}
            processedContent={processedContent}
            annotations={annotations}
            onWordClick={handleWordClick}
            getWordAnnotation={getWordAnnotation}
            isClickable={isClickable}
            currentPage={currentPage}
            onPageChange={handlePageChange}
            onTotalPagesChange={setTotalPagesState}
            fontSize={fontSize}
            lineHeight={lineHeight}
            textColor={textColor}
            backgroundColor={backgroundColor}
            annotationColor={annotationColor}
            annotationFontSize={annotationFontSize}
            highlightBg={highlightBg}
            highlightBgHover={highlightBgHover}
            isDarkMode={isDarkMode}
          />
        </div>

        {/* Sidebar */}
        <VocabularySidebar
          annotations={annotations}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onClearAll={clearAllAnnotations}
          onWordClick={scrollToWord}
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
          position={selectedWord.position}
          onAnnotateAll={annotateAll}
          onRemoveAnnotation={removeAnnotation}
          onClose={closeTooltip}
          isAnnotated={!!annotations[selectedWord.word.toLowerCase()]}
          annotation={annotations[selectedWord.word.toLowerCase()] || null}
          isDarkMode={isDarkMode}
          textColor={textColor}
          accentColor={annotationColor}
        />
      )}

      {/* Loading Indicator */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <span style={{ color: isDarkMode ? "#ccc" : "#666" }}>正在标注...</span>
        </div>
      )}

      <style jsx>{`
        .app-container {
          min-height: 100vh;
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

        .app-title {
          font-size: 18px;
          font-weight: 600;
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }

        .settings-btn {
          padding: 8px 12px;
          border: 1px solid;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .settings-btn:hover {
          filter: brightness(0.95);
        }

        .header-stats {
          display: flex;
          gap: 16px;
          font-size: 14px;
        }

        .stat strong {
          color: #4a90d9;
        }

        .dict-status {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          animation: fadeIn 0.2s ease;
        }

        .dict-status-loading {
          background: #fff3cd;
          color: #856404;
        }

        .dict-status-loaded {
          background: #d4edda;
          color: #155724;
        }

        .dict-status-failed {
          background: #f8d7da;
          color: #721c24;
        }

        .dict-status-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(0, 0, 0, 0.1);
          border-top-color: #856404;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .sidebar-toggle {
          background: none;
          border: 1px solid #ddd;
          padding: 8px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          transition: all 0.15s ease;
        }

        .sidebar-toggle:hover {
          filter: brightness(0.95);
        }

        .header-center {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
        }

        .page-display {
          font-size: 14px;
          font-weight: 500;
        }

        .toc-btn,
        .bookmark-btn {
          background: none;
          border: 1px solid #ddd;
          padding: 8px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          transition: all 0.15s ease;
        }

        .toc-btn:hover,
        .bookmark-btn:hover {
          filter: brightness(0.95);
        }

        /* Left Drawer Styles */
        .left-drawer-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 100;
          opacity: 0;
          visibility: hidden;
          transition: all 0.3s ease;
        }

        .left-drawer-overlay.open {
          opacity: 1;
          visibility: visible;
        }

        .left-drawer {
          position: fixed;
          top: 0;
          left: 0;
          width: 300px;
          height: 100vh;
          z-index: 101;
          transform: translateX(-100%);
          transition: transform 0.3s ease;
          box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
          display: flex;
          flex-direction: column;
        }

        .left-drawer.open {
          transform: translateX(0);
        }

        .left-drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid;
        }

        .left-drawer-tabs {
          display: flex;
          gap: 16px;
        }

        .drawer-tab {
          background: none;
          border: none;
          padding: 8px 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.15s ease;
        }

        .drawer-close {
          background: none;
          border: none;
          padding: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
        }

        .left-drawer-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .toc-list,
        .bookmark-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .toc-item {
          width: 100%;
          text-align: left;
          padding: 10px 12px;
          background: none;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.15s ease;
        }

        .toc-item:hover {
          background: rgba(0, 0, 0, 0.05);
        }

        .add-bookmark-btn {
          width: 100%;
          padding: 12px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .add-bookmark-btn:hover {
          filter: brightness(0.95);
        }

        .bookmark-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-radius: 6px;
        }

        .bookmark-page {
          background: none;
          border: none;
          font-size: 14px;
          cursor: pointer;
        }

        .bookmark-page:hover {
          text-decoration: underline;
        }

        .bookmark-delete {
          background: none;
          border: none;
          padding: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
        }

        .bookmark-delete:hover {
          color: #e74c3c !important;
        }

        .empty-message {
          text-align: center;
          padding: 24px;
          font-size: 14px;
        }

        .empty-message p {
          margin: 0 0 16px 0;
        }

        .main-content {
          /* Let ReadingArea manage its own layout */
        }

        .reading-container {
          /* Let ReadingArea manage its own layout */
        }

        .loading-overlay {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(255, 255, 255, 0.95);
          padding: 24px 32px;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          z-index: 100;
        }

        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #e0e0e0;
          border-top-color: #4a90d9;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
