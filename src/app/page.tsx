"use client";

import React, { useState, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { type ReadingAreaRef } from "@/components/ReadingArea";
import { BookshelfHomeView } from "@/app/_home/BookshelfHomeView";
import { ReadingHomeView } from "@/app/_home/ReadingHomeView";
import { usePeriodicSync } from "@/hooks/usePeriodicSync";
import JSLibLoader from "@/components/JSLibLoader";
import { useBookshelf, ProcessedContent, SentenceAnnotation, type Book } from "@/hooks/useBookshelf";
import { useSync, type SyncData, type BookManifestEntry } from "@/hooks/useSync";
import { sha256Utf8 } from "@/lib/syncSha256";
import { useReadingSettings } from "@/hooks/useReadingSettings";
import { useBookshelfTheme } from "@/hooks/useBookshelfTheme";
import { lemmatize, getWordMeaning, getWordMeaningEn, findWordFamily, loadBuiltinDictionary, loadBuiltinDictionaryEn } from "@/lib/dictionary";
import { translateWord, translateWordEn, translateSentence } from "@/lib/translate";
import { forceReloadDictionary, lookupExternalDict, lookupExternalDictEn, loadExternalDictionaryEn, type DictLoadStatus } from "@/lib/dictLoader";
import { cleanTranslation, shortenTranslation } from "@/lib/annotationText";
import { processTextToSegmentsAsync } from "@/lib/processBookContent";

async function hashesFromMergedBooks(bookList: Book[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    bookList.map(async (b) => {
      out[b.id] = await sha256Utf8(typeof b.content === "string" ? b.content : "");
    })
  );
  return out;
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
    renameBook,
    updateBookAnnotations,
    updateScrollPosition,
    updateReadPage,
    openBook,
    closeBook,
    addBookmark,
    removeBookmark,
    globalVocabulary,
    addToGlobalVocabulary,
    removeFromGlobalVocabulary,
    clearGlobalVocabulary,
    mergeGlobalVocabulary,
    updateBooksSyncHashes,
    replaceAllFromRemote,
    incrementCorrectCount,
    clearMasteredWords,
    addSentenceAnnotation,
    removeSentenceAnnotation,
    flushBooksToStorage,
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
    setSidebarState,
    resetToDefault,
    dictMode,
    setDictMode,
    pageTurnRatio,
    setPageTurnRatio,
    clickToTurnPage,
    setClickToTurnPage,
  } = useReadingSettings();

  // Bookshelf theme (independent from reading theme)
  const { theme: bookshelfTheme, themeId: bookshelfThemeId, setThemeId: setBookshelfThemeId } = useBookshelfTheme();

  // Reading state
  const [text, setText] = useState<string>("");
  const [processedContent, setProcessedContent] = useState<ProcessedContent | null>(null);
  const [annotations, setAnnotations] = useState<
    Record<string, { root: string; meaning: string; pos: string; count: number }>
  >({});
  const [selectedWord, setSelectedWord] = useState<{
    word: string;
    /** 与正文分词一致的词根键，用于查词与合并标注（全局词汇 + 本书） */
    lemma: string;
    position: { x: number; y: number };
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [annotating, setAnnotating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [leftDrawerTab, setLeftDrawerTab] = useState<'toc' | 'bookmarks'>('toc');
  const [tocReversed, setTocReversed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const readingAreaRef = useRef<ReadingAreaRef | null>(null);
  const tocScrollContainerRef = useRef<HTMLDivElement>(null);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ paragraphIndex: number; charIndex: number }>>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Ref to track if we're currently in a programmatic scroll
  const isProgrammaticScrollRef = useRef(false);
  
  // Ref for debounced scroll save
  const scrollSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track last processed book ID to avoid duplicate processing
  const lastProcessedBookIdRef = useRef<string | null>(null);
  
  // Store current book data in refs to avoid dependency issues
  const currentBookIdRef = useRef<string | null>(null);
  const currentBookContentRef = useRef<string>("");
  const currentBookAnnotationsRef = useRef<
    Record<string, { root: string; meaning: string; pos: string; count: number }>
  >({});
  /** 最近一次由页面写入书架的 annotations 引用，用于跳过「写回书本 → effect 又 setAnnotations」的回声，减轻取消标注时闪烁 */
  const lastPersistedAnnotationsRef = useRef<
    Record<string, { root: string; meaning: string; pos: string; count: number }> | null
  >(null);

  // Dictionary loading status
  const [dictLoadStatus, setDictLoadStatus] = useState<DictLoadStatus>('idle');
  const dictStatusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Mobile more menu state
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  // Data management modal state
  const [dataManageOpen, setDataManageOpen] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [activeTab, setActiveTab] = useState<'bookshelf' | 'vocabulary' | 'backup'>('bookshelf');

  // Cloud sync state
  const [syncPanelOpen, setSyncPanelOpen] = useState(false);
  const [syncJustCreated, setSyncJustCreated] = useState(false);
  // 书籍导入成功后显示同步提示
  const [showImportSyncTip, setShowImportSyncTip] = useState(false);
  const {
    syncCode,
    syncing,
    lastSyncAt,
    syncError,
    setSyncError,
    createSync,
    bindSyncCode,
    syncBoth,
    pushData,
    unbind,
  } = useSync();

  // 同步按钮点击（不切换 tab，只打开弹窗）
  const handleSyncClick = useCallback(() => {
    setSyncPanelOpen(true);
  }, []);

  // 轻量同步数据：vocab + progress + bookManifest，不含书籍正文
  const buildLightSyncData = useCallback(async (): Promise<{
    data: { vocabulary: Record<string, unknown>; bookProgress: Record<string, unknown> };
    bookManifest: BookManifestEntry[];
    contentHashes: Record<string, string>;
  }> => {
    const contentHashes: Record<string, string> = {};
    const bookManifest: BookManifestEntry[] = [];

    await Promise.all(
      books.map(async (book) => {
        const contentStr = typeof book.content === "string" ? book.content : "";
        const hash = await sha256Utf8(contentStr);
        contentHashes[book.id] = hash;
        bookManifest.push({ id: book.id, title: book.title, contentHash: hash });
      })
    );

    return {
      data: {
        vocabulary: globalVocabulary,
        bookProgress: books.reduce((acc: Record<string, {
          title: string;
          lastScrollPosition: number;
          lastParagraphIndex: number;
          lastParagraphText?: string;
          lastParagraphOffsetRatio?: number;
          lastReadAt: number;
          annotations: Record<string, unknown>;
          sentenceAnnotations?: unknown[];
          bookmarks?: unknown[];
        }>, book) => {
          acc[book.id] = {
            title: book.title,
            lastScrollPosition: book.lastScrollPosition || 0,
            lastParagraphIndex: book.lastParagraphIndex || 0,
            lastParagraphText: book.lastParagraphText || "",
            lastParagraphOffsetRatio: book.lastParagraphOffsetRatio ?? 0,
            lastReadAt: book.lastReadAt,
            annotations: book.annotations,
            sentenceAnnotations: book.sentenceAnnotations || [],
            bookmarks: book.bookmarks || [],
          };
          return acc;
        }, {}),
      },
      bookManifest,
      contentHashes,
    };
  }, [globalVocabulary, books]);

  // 按 ID 列表构建完整书籍数据（仅在 needBooks 时调用）
  const buildBooksPayload = useCallback((bookIds: string[]): Book[] => {
    const idSet = new Set(bookIds);
    return books
      .filter(b => idSet.has(b.id))
      .map(book => {
        const { processedContent, syncContentHash, ...rest } = book;
        void processedContent;
        void syncContentHash;
        return rest;
      });
  }, [books]);

  // 首次创建同步码时的完整数据（含全部书籍正文）
  const buildFullSyncData = useCallback(async (): Promise<{
    data: SyncData;
    contentHashes: Record<string, string>;
  }> => {
    const contentHashes: Record<string, string> = {};
    const booksPayload = books.map((book) => {
      const { processedContent, syncContentHash, ...rest } = book;
      void processedContent;
      void syncContentHash;
      return rest;
    });

    await Promise.all(
      booksPayload.map(async (book) => {
        const contentStr = typeof book.content === "string" ? book.content : "";
        contentHashes[book.id] = await sha256Utf8(contentStr);
      })
    );

    return {
      data: {
        vocabulary: globalVocabulary,
        bookProgress: books.reduce((acc: Record<string, {
          title: string;
          lastScrollPosition: number;
          lastParagraphIndex: number;
          lastParagraphText?: string;
          lastParagraphOffsetRatio?: number;
          lastReadAt: number;
          annotations: Record<string, unknown>;
          sentenceAnnotations?: unknown[];
          bookmarks?: unknown[];
        }>, book) => {
          acc[book.id] = {
            title: book.title,
            lastScrollPosition: book.lastScrollPosition || 0,
            lastParagraphIndex: book.lastParagraphIndex || 0,
            lastParagraphText: book.lastParagraphText || "",
            lastParagraphOffsetRatio: book.lastParagraphOffsetRatio ?? 0,
            lastReadAt: book.lastReadAt,
            annotations: book.annotations,
            sentenceAnnotations: book.sentenceAnnotations || [],
            bookmarks: book.bookmarks || [],
          };
          return acc;
        }, {}),
        books: booksPayload as SyncData["books"],
      },
      contentHashes,
    };
  }, [globalVocabulary, books]);

  // Handle create sync - push current local data to cloud (full payload with books)
  const handleCreateSync = useCallback(async () => {
    try {
      if (syncCode) {
        const localBookCount = books.filter(b => !b.isSample).length;
        try {
          const res = await fetch("/api/sync/pull", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ syncCode }),
          });
          if (res.ok) {
            const result = await res.json() as { data?: { books?: unknown[] } };
            const cloudBookCount = result.data?.books?.length ?? 0;
            if (cloudBookCount > localBookCount) {
              const confirmed = window.confirm(
                `云端有 ${cloudBookCount} 本书，但本地只有 ${localBookCount} 本。\n\n重新生成同步码会用本地数据替换云端，云端多出的 ${cloudBookCount - localBookCount} 本书将被删除。\n\n确定要继续吗？`
              );
              if (!confirmed) return;
            }
          }
        } catch {
          // network error checking cloud — proceed anyway
        }
      }

      const { data, contentHashes } = await buildFullSyncData();
      const code = await createSync(data);
      if (code) {
        setSyncJustCreated(true);
        updateBooksSyncHashes(contentHashes);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '创建同步失败';
      setSyncError(msg);
    }
  }, [buildFullSyncData, createSync, updateBooksSyncHashes, setSyncError, syncCode, books]);

  // Handle bind existing sync code — 绑定时用云端数据整体覆盖本地
  const handleBindSync = useCallback(async (code: string) => {
    const remoteData = await bindSyncCode(code);
    if (remoteData) {
      replaceAllFromRemote(remoteData);
      if (remoteData.books) {
        const hashes = await hashesFromMergedBooks(remoteData.books as Book[]);
        updateBooksSyncHashes(hashes);
      }
    }
  }, [
    bindSyncCode,
    replaceAllFromRemote,
    updateBooksSyncHashes,
  ]);

  // Handle sync — 两阶段轻量同步
  // syncBoth 返回带 books 的 data → 云端书目变化，整体覆盖
  // syncBoth 返回不带 books 的 data → 云端只更新了 vocab/progress
  // syncBoth 返回 null → 本地更新已推送到云端
  const handleSync = useCallback(async () => {
    try {
      const { data: lightData, bookManifest, contentHashes } = await buildLightSyncData();
      const remoteData = await syncBoth({
        data: lightData,
        bookManifest,
        getBooksForIds: buildBooksPayload,
        onConfirmOverwrite: async ({ localCount, cloudCount }) => {
          return window.confirm(
            `云端有 ${cloudCount} 本书，但本地只有 ${localCount} 本。\n\n继续同步会用本地书目覆盖云端，云端多出的 ${cloudCount - localCount} 本书将被删除。\n\n确定要继续吗？`
          );
        },
      });

      if (remoteData) {
        replaceAllFromRemote(remoteData);
        if (remoteData.books) {
          const hashes = await hashesFromMergedBooks(remoteData.books as Book[]);
          updateBooksSyncHashes(hashes);
        }
      } else {
        updateBooksSyncHashes(contentHashes);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '同步失败';
      setSyncError(msg);
    }
  }, [
    syncBoth,
    buildLightSyncData,
    buildBooksPayload,
    replaceAllFromRemote,
    updateBooksSyncHashes,
    setSyncError,
  ]);

  // 阅读中使用的轻量推送：只上传进度/词汇/标注，不拉取远端数据
  const performLightPushOnly = useCallback(async () => {
    try {
      const { data: lightData } = await buildLightSyncData();
      await pushData(lightData);
      return null;
    } catch (err) {
      console.warn('[LightPush]', err instanceof Error ? err.message : err);
      return null;
    }
  }, [buildLightSyncData, pushData]);

  const performSyncForPeriodic = useCallback(async () => {
    try {
      const { data: lightData, bookManifest, contentHashes } = await buildLightSyncData();
      const remoteData = await syncBoth({
        data: lightData,
        bookManifest,
        getBooksForIds: buildBooksPayload,
        onConfirmOverwrite: async () => false,
      });

      if (remoteData) {
        replaceAllFromRemote(remoteData);
        if (remoteData.books) {
          const hashes = await hashesFromMergedBooks(remoteData.books as Book[]);
          updateBooksSyncHashes(hashes);
        }
      } else {
        updateBooksSyncHashes(contentHashes);
      }

      return remoteData;
    } catch (err) {
      console.warn('[PeriodicSync]', err instanceof Error ? err.message : err);
      return null;
    }
  }, [
    syncBoth,
    buildLightSyncData,
    buildBooksPayload,
    replaceAllFromRemote,
    updateBooksSyncHashes,
  ]);

  // 自动定时同步（每10分钟）
  // 书架：完整双向同步；阅读中：仅推送进度/词汇/标注，不拉取远端数据
  usePeriodicSync({
    syncCode,
    syncing,
    performSync: currentBook ? performLightPushOnly : performSyncForPeriodic,
    enabled: true,
  });

  // Sentence translation state
  const [translatingSelection, setTranslatingSelection] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<{
    text: string;
    startParagraphIndex: number;
    endParagraphIndex: number;
    startCharIndex: number;
    endCharIndex: number;
    position: { x: number; y: number };
  } | null>(null);

  // 清理可能残留的大数据（启动时一次性执行）
  useEffect(() => {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.includes('content_chunk') || 
          key.includes('processedContent') || 
          key.includes('cache_version')
        )) {
          keys.push(key);
        }
      }
      keys.forEach(key => localStorage.removeItem(key));
      
      // 检查总使用量
      let totalSize = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          totalSize += (localStorage.getItem(key) || '').length;
        }
      }
      const totalMB = (totalSize * 2 / 1024 / 1024).toFixed(2);
      
      if (totalSize * 2 > 4 * 1024 * 1024) {
        console.warn('localStorage 使用量接近上限，考虑删除部分书籍');
      }
    } catch (e) {
      console.warn('清理 localStorage 失败:', e);
    }
  }, []);

  // Load external dictionary on mount (force reload to get latest dict.json and dict_en.json)
  useEffect(() => {
    // 同时加载中英词典和英英词典
    loadBuiltinDictionary();
    loadBuiltinDictionaryEn();
    
    Promise.all([
      forceReloadDictionary(),
      loadExternalDictionaryEn()
    ]).then(([zhStatus, enStatus]) => {
      setDictLoadStatus(zhStatus);

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


  // Effect-book: sync book content/annotations and process on first open
  useEffect(() => {
    if (!currentBook) {
      currentBookIdRef.current = null;
      currentBookContentRef.current = "";
      currentBookAnnotationsRef.current = {};
      lastPersistedAnnotationsRef.current = null;
      lastProcessedBookIdRef.current = null;
      setProcessedContent(null);
      setLoading(false);
      return;
    }

    currentBookIdRef.current = currentBook.id;

    if (currentBookContentRef.current !== currentBook.content) {
      currentBookContentRef.current = currentBook.content;
      setText(currentBook.content);
    }

    // Annotations：从书架载入 / 云端合并后的书本对象；跳过刚由 useLayoutEffect 持久化产生的同一引用回声，避免取消标注闪烁
    if (currentBookAnnotationsRef.current !== currentBook.annotations) {
      const incoming = currentBook.annotations;
      const isEcho =
        lastPersistedAnnotationsRef.current !== null &&
        incoming === lastPersistedAnnotationsRef.current;
      currentBookAnnotationsRef.current = incoming;
      if (!isEcho) {
        setAnnotations(incoming);
      }
    }

    // Only process segments on first open (bookId change)
    if (lastProcessedBookIdRef.current !== currentBook.id) {
      setProcessedContent(null);
      lastProcessedBookIdRef.current = currentBook.id;
      setLoading(true);

      const savedScrollPercent = currentBook.lastScrollPosition || 0;
      const savedParagraphIndex = currentBook.lastParagraphIndex ?? -1;

      const persistedText = currentBook.lastParagraphText || "";

      processTextToSegmentsAsync(currentBook.content).then((processed) => {
        setProcessedContent(processed);
        setLoading(false);

        if (persistedText) {
          setCurrentParagraphText(persistedText);
        } else if (savedParagraphIndex >= 0 && savedParagraphIndex < processed.length) {
          const derived = processed[savedParagraphIndex].segments
            .map((s) => s.text)
            .join("")
            .substring(0, 80);
          setCurrentParagraphText(derived);
        } else {
          setCurrentParagraphText("");
        }
      });
    }
  }, [currentBook?.id, currentBook?.content, currentBook?.annotations]);

  // 打开/切换书籍时不自动弹出词汇表侧栏（仍可通过按钮手动打开）
  useEffect(() => {
    if (!currentBook) {
      setSidebarOpen(false);
      return;
    }
    setSidebarOpen(false);
  }, [currentBook?.id]);
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
    // 打开后自动滚动到当前章节
    setTimeout(() => {
      const activeItem = document.querySelector('.toc-item.toc-active');
      if (activeItem) {
        activeItem.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }, 100);
  }, []);

  // Handle bookmark button click
  const handleBookmarkClick = useCallback(() => {
    setLeftDrawerTab('bookmarks');
    setLeftDrawerOpen(true);
  }, []);

  // Current scroll percent for bookmarks
  const [currentScrollPercent, setCurrentScrollPercent] = useState(0);
  const [currentParagraphIndex, setCurrentParagraphIndex] = useState(-1);
  const [currentParagraphText, setCurrentParagraphText] = useState("");
  const [currentParagraphOffsetRatio, setCurrentParagraphOffsetRatio] = useState(0);
  const [currentChapterTitle, setCurrentChapterTitle] = useState("");

  // Always-current refs for scroll position — used for flush-on-close
  const scrollPercentRef = useRef(0);
  const paragraphIndexRef = useRef(-1);
  const paragraphTextRef = useRef("");
  const paragraphOffsetRatioRef = useRef(0);
  useEffect(() => { scrollPercentRef.current = currentScrollPercent; }, [currentScrollPercent]);
  useEffect(() => { paragraphIndexRef.current = currentParagraphIndex; }, [currentParagraphIndex]);
  useEffect(() => { paragraphTextRef.current = currentParagraphText; }, [currentParagraphText]);
  useEffect(() => { paragraphOffsetRatioRef.current = currentParagraphOffsetRatio; }, [currentParagraphOffsetRatio]);

  // Save scroll percent to Book object when it changes
  // 延迟保存，避免恢复跳转过程中的中间值覆盖真实位置
  const hasInitializedRef = useRef(false);
  const initTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (currentBook?.id) {
      hasInitializedRef.current = false;
      if (initTimerRef.current) clearTimeout(initTimerRef.current);
      initTimerRef.current = setTimeout(() => {
        hasInitializedRef.current = true;
      }, 3000);
    }
    return () => {
      if (initTimerRef.current) clearTimeout(initTimerRef.current);
    };
  }, [currentBook?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const bookId = currentBookIdRef.current;
    if (!bookId) return;
    if (!hasInitializedRef.current) return;
    if (currentScrollPercent === 0 && currentParagraphIndex <= 0) return;

    const timeout = setTimeout(() => {
      updateScrollPosition(bookId, currentScrollPercent, currentParagraphIndex, currentParagraphText || undefined, currentParagraphOffsetRatio);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [currentScrollPercent, currentParagraphIndex, currentParagraphText, currentParagraphOffsetRatio, updateScrollPosition]);

  const flushScrollPosition = useCallback(() => {
    const bookId = currentBookIdRef.current;
    if (!bookId) return;
    const pct = scrollPercentRef.current;
    const idx = paragraphIndexRef.current;
    const txt = paragraphTextRef.current;
    const oRatio = paragraphOffsetRatioRef.current;
    if (pct === 0 && idx <= 0) return;
    updateScrollPosition(bookId, pct, idx, txt || undefined, oRatio);
    flushBooksToStorage({
      bookId, percent: pct, paragraphIndex: idx, paragraphText: txt || undefined, paragraphOffsetRatio: oRatio,
    });
  }, [updateScrollPosition, flushBooksToStorage]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      flushScrollPosition();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushScrollPosition();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [flushScrollPosition]);


  // Toggle bookmark for current position
  const toggleCurrentBookmark = useCallback(() => {
    const bookId = currentBookIdRef.current;
    if (!bookId || !currentBook) return;
    
    const bookmarks = currentBook.bookmarks || [];
    const hasBookmark = bookmarks.some((bm) => bm.page === currentScrollPercent);
    
    if (hasBookmark) {
      const bookmark = bookmarks.find((bm) => bm.page === currentScrollPercent);
      if (bookmark) {
        removeBookmark(bookId, bookmark.id);
      }
    } else {
      // Get preview text from current scroll position (first visible paragraph)
      const previewText = `位置 ${Math.round(currentScrollPercent)}%`;
      addBookmark(bookId, currentScrollPercent, previewText);
    }
  }, [currentBook, currentScrollPercent, addBookmark, removeBookmark]);

  // 先于浏览器绘制把标注写回书架，缩短「页面 state 已删、书本对象仍是旧引用」的窗口；并记录引用供上方 effect 识别回声
  useLayoutEffect(() => {
    const bookId = currentBookIdRef.current;
    if (bookId) {
      updateBookAnnotations(bookId, annotations);
      lastPersistedAnnotationsRef.current = annotations;
    }
  }, [annotations, updateBookAnnotations]);

  // Handle scroll - 已通过 ReadingArea 的 onProgressChange 回调保存进度百分比
  // window scroll 事件不再需要，因为 ReadingArea 使用内部容器滚动


  // Handle word click
  const handleWordClick = useCallback(
    async (word: string, lemma: string, event: React.MouseEvent) => {
      const cleanWord = word.toLowerCase().trim();
      if (!cleanWord) return;

      const rect = (event.target as HTMLElement).getBoundingClientRect();

      // 延迟300ms弹窗，给双击留出时间
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
      clickTimerRef.current = setTimeout(() => {
        const lemmaKey =
          lemma && lemma.trim().length > 0 ? lemma.trim() : lemmatize(cleanWord);
        setSelectedWord({
          word: cleanWord,
          lemma: lemmaKey,
          position: {
            x: rect.left + rect.width / 2,
            y: rect.top - 10,
          },
        });
        clickTimerRef.current = null;
      }, 300);
    },
    []
  );

  // Handle word double click - auto annotate without popup
  const handleWordDoubleClick = useCallback(
    async (word: string, lemma: string, event: React.MouseEvent) => {
      // 取消单击弹窗
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      setSelectedWord(null);

      const cleanWord = word.toLowerCase().trim();
      if (!cleanWord) return;

      const root = lemmatize(cleanWord);

      // Skip if already annotated with same mode
      const existing = annotations[root];
      const existingMatchesMode =
        existing &&
        (
          dictMode === "en"
            ? !/[\u4e00-\u9fff]/.test(existing.meaning)
            : /[\u4e00-\u9fff]/.test(existing.meaning)
        );

      if (existingMatchesMode) {
        return;
      }

      // Auto-annotate
      const isEnglishMode = dictMode === 'en';

      // 1. 先查内置词典
      let rawMeaning = "";
      if (isEnglishMode) {
        const enEntry = getWordMeaningEn(cleanWord);
        if (enEntry) rawMeaning = enEntry;
      } else {
        const zhEntry = getWordMeaning(cleanWord);
        if (zhEntry?.meaning) rawMeaning = zhEntry.meaning;
      }

      // 2. 内置词典没有，再查外部词典
      if (!rawMeaning) {
        const extMeaning = isEnglishMode
          ? lookupExternalDictEn(cleanWord)
          : lookupExternalDict(cleanWord);
        if (extMeaning) rawMeaning = extMeaning;
      }

      // 3. 外部词典也没有，调用AI翻译
      if (!rawMeaning) {
        rawMeaning = isEnglishMode
          ? await translateWordEn(cleanWord)
          : await translateWord(cleanWord);
      }

      if (rawMeaning) {
        // 精简释义
        const shortMeaning = shortenTranslation(rawMeaning, isEnglishMode ? 'en' : 'zh');
        const newAnnotation = { root, meaning: shortMeaning, pos: "", count: 1 };
        setAnnotations((prev) => ({
          ...prev,
          [root]: newAnnotation,
        }));
        // 勿在此处再调用 updateBookAnnotations：会与 useLayoutEffect 持久化打架（两份额外 annotations 引用），
        // 触发 book 同步 effect 反复 setAnnotations → Maximum update depth exceeded
        addToGlobalVocabulary(root, shortMeaning, "");
      }
    },
    [annotations, currentBook, dictMode, addToGlobalVocabulary]
  );

  // Annotate all occurrences of a word
  const annotateAll = useCallback(
    async (word: string) => {
      const cleanWord = word.toLowerCase().trim();
      const root = lemmatize(cleanWord);

const existing = annotations[root];
const existingMatchesMode =
  existing &&
  (
    dictMode === "en"
      ? !/[\u4e00-\u9fff]/.test(existing.meaning)
      : /[\u4e00-\u9fff]/.test(existing.meaning)
  );

if (existingMatchesMode) {
  return;
}


//      setLoading(true);
      setSelectedWord(null);

      setAnnotating(true);  
      try {
        let rawMeaning = "";
        const isEnglishMode = dictMode === 'en';

        // 调试日志
        console.log('=== 开始查词 ===');
        console.log('原始单词:', word);
        console.log('词根:', root);
        console.log('当前模式:', isEnglishMode ? '英文模式' : '中文模式');

if (isEnglishMode) {
  console.log("第一层（英文）：查 englishDictionaryEn");
  const enEntry = getWordMeaningEn(root);
  console.log("英英内置词典结果:", enEntry);

  if (enEntry) {
    rawMeaning = enEntry;
  }

  if (!rawMeaning) {
    console.log("第二层（英文）：查 dict_en.json (externalDictEn)");
  const extEnMeaning = lookupExternalDictEn(root) || lookupExternalDictEn(cleanWord);

    console.log("外部英英词典结果:", extEnMeaning);
    if (extEnMeaning) {
      rawMeaning = extEnMeaning;
    }
  }

  if (!rawMeaning) {
    console.log("第三层（英文）：调用 AI 英英释义");
rawMeaning = await translateWordEn(root || cleanWord);

  }
}

 else {
          // 中文模式查词流程（原有逻辑不变）
          console.log('第一层（中文）：查 englishDictionary');
          const entry = getWordMeaning(root);
          console.log('内置词典结果:', entry);
          if (entry?.meaning) {
            rawMeaning = entry.meaning;
          }

          // 2. 查外部词典（带智能后缀去除）
          if (!rawMeaning) {
            console.log('第二层（中文）：查 dict.json (externalDict)');
            const extMeaning = lookupExternalDict(cleanWord);
            console.log('外部词典结果:', extMeaning);
            if (extMeaning) {
              rawMeaning = extMeaning;
            }
          }

          // 3. 最后才调用AI翻译
          if (!rawMeaning) {
            console.log('第三层（中文）：调用AI翻译');
            rawMeaning = await translateWord(cleanWord);

          }
        }

        // 清洗并精简释义
const meaning = shortenTranslation(rawMeaning, isEnglishMode ? "en" : "zh");

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
                // 同时写入全局词汇表
        addToGlobalVocabulary(root, meaning, "");

      } catch (err) {
        console.error("Annotation error:", err);
      } finally {
//        setLoading(false);
                setAnnotating(false); 
        setSelectedWord(null);
      }
    },
    [annotations, text, dictMode, addToGlobalVocabulary]

  );

  // Remove annotation
  const removeAnnotation = useCallback((word: string, lemmaOverride?: string) => {
    const root =
      lemmaOverride !== undefined && lemmaOverride.trim().length > 0
        ? lemmaOverride.trim()
        : lemmatize(word.toLowerCase());
    setAnnotations((prev) => {
      const next = { ...prev };
      delete next[root];
      return next;
    });
    // 同时从全局词汇表删除
    removeFromGlobalVocabulary(root);
    setSelectedWord(null);
  }, [removeFromGlobalVocabulary]);

  // Handle text selection for sentence translation - 只保存选区，不翻译
  const handleTextSelect = useCallback(
    (selection: {
      text: string;
      startParagraphIndex: number;
      endParagraphIndex: number;
      startCharIndex: number;
      endCharIndex: number;
    }) => {
      queueMicrotask(() => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const rect = sel.getRangeAt(0).getBoundingClientRect();

        setPendingSelection({
          ...selection,
          position: {
            x: rect.left + rect.width / 2,
            y: rect.top - 10,
          },
        });
      });
    },
    []
  );

  // 点击「翻译标注」按钮后才执行翻译
  const handleTranslateSentence = useCallback(async () => {
    if (!pendingSelection || !currentBook) return;

    setTranslatingSelection(true);
    try {
      const translation = await translateSentence(pendingSelection.text);

      const annotation: SentenceAnnotation = {
        id: `sa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        startParagraphIndex: pendingSelection.startParagraphIndex,
        startCharIndex: pendingSelection.startCharIndex,
        endParagraphIndex: pendingSelection.endParagraphIndex,
        endCharIndex: pendingSelection.endCharIndex,
        originalText: pendingSelection.text,
        translation,
        createdAt: Date.now(),
      };

      addSentenceAnnotation(currentBook.id, annotation);
    } catch (err) {
      console.error("Sentence translation error:", err);
    } finally {
      setTranslatingSelection(false);
      setPendingSelection(null);
      window.getSelection()?.removeAllRanges();
    }
  }, [pendingSelection, currentBook, addSentenceAnnotation]);

  // 添加笔记
  const handleAddNote = useCallback((noteText: string) => {
    if (!pendingSelection || !currentBook || !noteText.trim()) return;

    const annotation: SentenceAnnotation = {
      id: `sa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      startParagraphIndex: pendingSelection.startParagraphIndex,
      startCharIndex: pendingSelection.startCharIndex,
      endParagraphIndex: pendingSelection.endParagraphIndex,
      endCharIndex: pendingSelection.endCharIndex,
      originalText: pendingSelection.text,
      translation: noteText.trim(),
      type: "note",
      createdAt: Date.now(),
    };

    addSentenceAnnotation(currentBook.id, annotation);
    setPendingSelection(null);
    window.getSelection()?.removeAllRanges();
  }, [pendingSelection, currentBook, addSentenceAnnotation]);

  // 关闭浮窗
  const closePendingSelection = useCallback(() => {
    setPendingSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  // Handle remove sentence annotation
  const handleRemoveSentenceAnnotation = useCallback(
    (annotationId: string) => {
      if (!currentBook) return;
      removeSentenceAnnotation(currentBook.id, annotationId);
    },
    [currentBook, removeSentenceAnnotation]
  );


  // Clear all annotations
  const clearAllAnnotations = useCallback(() => {
    setAnnotations({});
    // 同时清空全局词汇表
    clearGlobalVocabulary();
  }, [clearGlobalVocabulary]);


  // Search functionality
  const performSearch = useCallback((query: string, content: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setCurrentSearchIndex(0);
      return;
    }

    const results: Array<{ paragraphIndex: number; charIndex: number }> = [];
    const paragraphs = content.split(/\n\n+/);
    const lowerQuery = query.toLowerCase();

    paragraphs.forEach((paragraph, pIndex) => {
      const lowerPara = paragraph.toLowerCase();
      let charIndex = 0;
      while (true) {
        const foundIndex = lowerPara.indexOf(lowerQuery, charIndex);
        if (foundIndex === -1) break;
        results.push({ paragraphIndex: pIndex, charIndex: foundIndex });
        charIndex = foundIndex + 1;
      }
    });

    setSearchResults(results);
    setCurrentSearchIndex(0);

    // Jump to first result if exists
    if (results.length > 0 && readingAreaRef.current) {
      readingAreaRef.current.jumpToSearchResult(results[0]);
    }
  }, []);

  const handleSearchInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(query, text);
    }, 300);
  }, [text, performSearch]);

  const goToNextSearchResult = useCallback(() => {
    if (searchResults.length === 0) return;
    const nextIndex = (currentSearchIndex + 1) % searchResults.length;
    setCurrentSearchIndex(nextIndex);
    readingAreaRef.current?.jumpToSearchResult(searchResults[nextIndex]);
  }, [searchResults, currentSearchIndex]);

  const goToPrevSearchResult = useCallback(() => {
    if (searchResults.length === 0) return;
    const prevIndex = currentSearchIndex === 0 ? searchResults.length - 1 : currentSearchIndex - 1;
    setCurrentSearchIndex(prevIndex);
    readingAreaRef.current?.jumpToSearchResult(searchResults[prevIndex]);
  }, [searchResults, currentSearchIndex]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setCurrentSearchIndex(0);
  }, []);

  // Handle keyboard shortcuts for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F or Cmd+F to open search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
        return;
      }

      // ESC to close search
      if (e.key === 'Escape' && searchOpen) {
        e.preventDefault();
        closeSearch();
        return;
      }

      // Don't handle other shortcuts if search is not open or search input is not focused
      if (!searchOpen || document.activeElement !== searchInputRef.current) {
        return;
      }

      // Enter to go to next result
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          goToPrevSearchResult();
        } else {
          goToNextSearchResult();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen, closeSearch, goToNextSearchResult, goToPrevSearchResult]);

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

  // Scroll to sentence in text
  const scrollToSentence = useCallback((annotation: SentenceAnnotation) => {
    readingAreaRef.current?.jumpToSearchResult({
      paragraphIndex: annotation.startParagraphIndex,
      charIndex: annotation.startCharIndex,
    });
    setSidebarOpen(false);
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

  // Go to specific paragraph from TOC
  const goToParagraph = useCallback((paragraphIndex: number) => {
    if (readingAreaRef.current) {
      readingAreaRef.current.jumpToParagraph(paragraphIndex);
    }
    setLeftDrawerOpen(false);
  }, []);

  // Handle return to bookshelf
  const handleReturnToBookshelf = useCallback(() => {
    flushScrollPosition();
    isProgrammaticScrollRef.current = true;
    lastProcessedBookIdRef.current = null;
    closeBook();
    setText("");
    setAnnotations({});
    setSelectedWord(null);
    setProcessedContent(null);
    setSettingsPanelOpen(false);
  }, [closeBook, flushScrollPosition]);

  // Load JSZip library for EPUB parsing
  <JSLibLoader />

  // 全局词汇作为底层，书本标注覆盖在上面
  const mergedAnnotationsForRender = React.useMemo(() => {
    const merged: Record<string, { root: string; meaning: string; pos: string; count: number }> = {};
    for (const [root, vocab] of Object.entries(globalVocabulary)) {
      merged[root] = { root: vocab.root, meaning: vocab.meaning, pos: vocab.pos, count: 0 };
    }
    for (const [root, ann] of Object.entries(annotations)) {
      merged[root] = ann; // 书本标注优先
    }
    return merged;
  }, [annotations, globalVocabulary]);

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
      <BookshelfHomeView
        activeTab={activeTab as "bookshelf" | "vocabulary" | "backup"}
        setActiveTab={setActiveTab}
        dataManageOpen={dataManageOpen}
        setDataManageOpen={setDataManageOpen}
        syncPanelOpen={syncPanelOpen}
        setSyncPanelOpen={setSyncPanelOpen}
        setSyncJustCreated={setSyncJustCreated}
        syncCode={syncCode}
        syncing={syncing}
        lastSyncAt={lastSyncAt}
        syncError={syncError}
        syncJustCreated={syncJustCreated}
        showImportSyncTip={showImportSyncTip}
        setShowImportSyncTip={setShowImportSyncTip}
        showQuiz={showQuiz}
        setShowQuiz={setShowQuiz}
        backgroundColor={backgroundColor}
        isDarkMode={isDarkMode}
        bookshelfTheme={bookshelfTheme}
        bookshelfThemeId={bookshelfThemeId}
        setBookshelfThemeId={setBookshelfThemeId}
        books={books}
        getProgress={getProgress}
        formatLastRead={formatLastRead}
        addBook={addBook}
        deleteBook={deleteBook}
        renameBook={renameBook}
        openBook={openBook}
        globalVocabulary={globalVocabulary}
        removeFromGlobalVocabulary={removeFromGlobalVocabulary}
        clearGlobalVocabulary={clearGlobalVocabulary}
        clearMasteredWords={clearMasteredWords}
        mergeGlobalVocabulary={mergeGlobalVocabulary}
        incrementCorrectCount={incrementCorrectCount}
        handleCreateSync={handleCreateSync}
        handleBindSync={handleBindSync}
        handleSync={handleSync}
        unbind={unbind}
      />
    );
  }


  // Reading view
  return (
    <ReadingHomeView
      containerRef={containerRef}
      readingAreaRef={readingAreaRef}
      currentBook={currentBook}
      processedContent={processedContent}
      annotations={annotations}
      mergedAnnotationsForRender={mergedAnnotationsForRender}
      text={text}
      loading={loading}
      annotating={annotating}
      sidebarOpen={sidebarOpen}
      settingsPanelOpen={settingsPanelOpen}
      leftDrawerOpen={leftDrawerOpen}
      leftDrawerTab={leftDrawerTab}
      tocReversed={tocReversed}
      tocScrollContainerRef={tocScrollContainerRef}
      currentScrollPercent={currentScrollPercent}
      currentParagraphIndex={currentParagraphIndex}
      currentParagraphText={currentParagraphText}
      currentChapterTitle={currentChapterTitle}
      searchOpen={searchOpen}
      searchQuery={searchQuery}
      searchResults={searchResults}
      currentSearchIndex={currentSearchIndex}
      searchInputRef={searchInputRef}
      moreMenuOpen={moreMenuOpen}
      pendingSelection={pendingSelection}
      translatingSelection={translatingSelection}
      selectedWord={selectedWord}
      backgroundColor={backgroundColor}
      headerBg={headerBg}
      headerTextColor={headerTextColor}
      textColor={textColor}
      annotationColor={annotationColor}
      highlightBg={highlightBg}
      highlightBgHover={highlightBgHover}
      sidebarBg={sidebarBg}
      isDarkMode={isDarkMode}
      fontSize={fontSize}
      lineHeight={lineHeight}
      currentTheme={currentTheme}
      dictMode={dictMode}
      pageTurnRatio={pageTurnRatio}
      clickToTurnPage={clickToTurnPage}
      dictLoadStatus={dictLoadStatus}
      syncPanelOpen={syncPanelOpen}
      setSyncPanelOpen={setSyncPanelOpen}
      setSyncJustCreated={setSyncJustCreated}
      syncCode={syncCode}
      syncing={syncing}
      lastSyncAt={lastSyncAt}
      syncError={syncError}
      syncJustCreated={syncJustCreated}
      handleCreateSync={handleCreateSync}
      handleBindSync={handleBindSync}
      handleSync={handleSync}
      unbind={unbind}
      handleWordClick={handleWordClick}
      handleWordDoubleClick={handleWordDoubleClick}
      getWordAnnotation={getWordAnnotation}
      isClickable={isClickable}
      annotateAll={annotateAll}
      removeAnnotation={removeAnnotation}
      clearAllAnnotations={clearAllAnnotations}
      scrollToWord={scrollToWord}
      scrollToSentence={scrollToSentence}
      handleRemoveSentenceAnnotation={handleRemoveSentenceAnnotation}
      goToParagraph={goToParagraph}
      toggleCurrentBookmark={toggleCurrentBookmark}
      removeBookmark={removeBookmark}
      handleReturnToBookshelf={handleReturnToBookshelf}
      handleSidebarToggle={handleSidebarToggle}
      handleTocClick={handleTocClick}
      handleBookmarkClick={handleBookmarkClick}
      closeTooltip={closeTooltip}
      handleTextSelect={handleTextSelect}
      handleTranslateSentence={handleTranslateSentence}
      handleAddNote={handleAddNote}
      closePendingSelection={closePendingSelection}
      setFontSize={setFontSize}
      setLineHeight={setLineHeight}
      setBackgroundTheme={setBackgroundTheme}
      resetToDefault={resetToDefault}
      setDictMode={setDictMode}
      setPageTurnRatio={setPageTurnRatio}
      setClickToTurnPage={setClickToTurnPage}
      setCurrentScrollPercent={setCurrentScrollPercent}
      setCurrentParagraphIndex={setCurrentParagraphIndex}
      setCurrentParagraphText={setCurrentParagraphText}
      setCurrentParagraphOffsetRatio={setCurrentParagraphOffsetRatio}
      setCurrentChapterTitle={setCurrentChapterTitle}
      setSidebarOpen={setSidebarOpen}
      setSettingsPanelOpen={setSettingsPanelOpen}
      setLeftDrawerOpen={setLeftDrawerOpen}
      setLeftDrawerTab={setLeftDrawerTab}
      setTocReversed={setTocReversed}
      setMoreMenuOpen={setMoreMenuOpen}
      setSearchOpen={setSearchOpen}
      setSearchQuery={setSearchQuery}
      setSearchResults={setSearchResults}
      setCurrentSearchIndex={setCurrentSearchIndex}
      handleSearchInput={handleSearchInput}
      goToNextSearchResult={goToNextSearchResult}
      goToPrevSearchResult={goToPrevSearchResult}
      closeSearch={closeSearch}
    />
  );
}
