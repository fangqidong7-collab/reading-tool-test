"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Bookshelf } from "@/components/Bookshelf";
import { ReadingArea } from "@/components/ReadingArea";
import { WordTooltip } from "@/components/WordTooltip";
import { VocabularySidebar } from "@/components/VocabularySidebar";
import { useBookshelf, ProcessedContent, ProcessedSegment } from "@/hooks/useBookshelf";
import { lemmatize, getWordMeaning, findWordFamily } from "@/lib/dictionary";
import { translateWord } from "@/lib/translate";
import { loadExternalDictionary, lookupExternalDict, type DictLoadStatus } from "@/lib/dictLoader";

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
    saveProcessedContent,
    openBook,
    closeBook,
  } = useBookshelf();

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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
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

  // Load external dictionary on mount
  useEffect(() => {
    loadExternalDictionary().then((status) => {
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
      // Check if processed content exists, if not, generate it
      if (currentBook.processedContent) {
        setProcessedContent(currentBook.processedContent);
      } else {
        // Process text and save to localStorage
        const processed = processTextToSegments(currentBook.content);
        setProcessedContent(processed);
        saveProcessedContent(currentBook.id, processed);
      }
      // Restore scroll position after a delay to allow content to render
      isProgrammaticScrollRef.current = true;
      setTimeout(() => {
        if (currentBook.lastScrollPosition && currentBook.lastScrollPosition > 0) {
          window.scrollTo({ top: currentBook.lastScrollPosition, behavior: "auto" });
        }
        // Reset the flag after scroll completes
        setTimeout(() => {
          isProgrammaticScrollRef.current = false;
        }, 100);
      }, 300);
    } else {
      currentBookIdRef.current = null;
      currentBookContentRef.current = "";
      currentBookAnnotationsRef.current = {};
      setProcessedContent(null);
    }
  }, [currentBook, saveProcessedContent]);

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
        let meaning = "";
        let pos = "";

        // 1. 先查内置词典
        const entry = getWordMeaning(root);
        if (entry?.meaning) {
          meaning = entry.meaning;
          pos = entry.pos;
        }

        // 2. 查外部词典（带智能后缀去除）
        if (!meaning) {
          const extMeaning = lookupExternalDict(cleanWord);
          if (extMeaning) {
            meaning = extMeaning;
            pos = "";
          }
        }

        // 3. 最后才调用AI翻译
        if (!meaning) {
          meaning = await translateWord(root);
          pos = "";
        }

        const family = findWordFamily(root, text);

        setAnnotations((prev) => ({
          ...prev,
          [root]: {
            root,
            meaning,
            pos,
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

  // Handle return to bookshelf
  const handleReturnToBookshelf = useCallback(() => {
    // Save scroll position before leaving
    const bookId = currentBookIdRef.current;
    if (bookId) {
      updateScrollPosition(bookId, window.scrollY);
    }
    isProgrammaticScrollRef.current = true;
    closeBook();
    setText("");
    setAnnotations({});
    setSelectedWord(null);
    setProcessedContent(null);
  }, [closeBook, updateScrollPosition]);

  // Show loading while initializing
  if (!isLoaded) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  // Bookshelf view (when no book is open)
  if (!currentBook) {
    return (
      <div className="bookshelf-page">
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
            background: #fff8f0;
          }
          .loading-screen {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #fff8f0;
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
    <div className="app-container">
      {/* Reading Header */}
      <header className="app-header">
        <div className="header-left">
          <button className="back-btn" onClick={handleReturnToBookshelf}>
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
            书架
          </button>
          <h1 className="app-title" title={currentBook.title}>
            {currentBook.title}
          </h1>
        </div>
        <div className="header-right">
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
          <div className="header-stats">
            <span className="stat">
              词汇: <strong>{Object.keys(annotations).length}</strong>
            </span>
          </div>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? "收起侧边栏" : "展开侧边栏"}
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
      <main className="main-content">
        <div ref={containerRef} className="reading-container">
          <ReadingArea
            text={text}
            processedContent={processedContent}
            annotations={annotations}
            onWordClick={handleWordClick}
            getWordAnnotation={getWordAnnotation}
            isClickable={isClickable}
          />
        </div>

        {/* Sidebar */}
        <VocabularySidebar
          annotations={annotations}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onClearAll={clearAllAnnotations}
          onWordClick={scrollToWord}
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
        />
      )}

      {/* Loading Indicator */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <span>正在标注...</span>
        </div>
      )}

      <style jsx>{`
        .app-container {
          min-height: 100vh;
          background: #fff8f0;
        }

        .app-header {
          position: sticky;
          top: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 24px;
          background: white;
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
          background: #f5f5f5;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          color: #666;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
        }

        .back-btn:hover {
          background: #e8e8e8;
          color: #333;
        }

        .app-title {
          font-size: 18px;
          font-weight: 600;
          color: #333;
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-shrink: 0;
        }

        .header-stats {
          display: flex;
          gap: 16px;
          font-size: 14px;
          color: #666;
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
          color: #666;
          display: flex;
          align-items: center;
          transition: all 0.15s ease;
        }

        .sidebar-toggle:hover {
          background: #f5f5f5;
          color: #333;
        }

        .main-content {
          display: flex;
          min-height: calc(100vh - 60px);
        }

        .reading-container {
          flex: 1;
          padding-bottom: 40px;
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

        .loading-overlay span {
          font-size: 14px;
          color: #666;
        }
      `}</style>
    </div>
  );
}
