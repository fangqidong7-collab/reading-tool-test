"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { type ReadingAreaRef } from "@/components/ReadingArea";
import { BookshelfHomeView } from "@/app/_home/BookshelfHomeView";
import { ReadingHomeView } from "@/app/_home/ReadingHomeView";
import { useSync } from "@/hooks/useSync";
import { usePeriodicSync } from "@/hooks/usePeriodicSync";
import JSLibLoader from "@/components/JSLibLoader";
import { useBookshelf, ProcessedContent, SentenceAnnotation } from "@/hooks/useBookshelf";
import { useReadingSettings } from "@/hooks/useReadingSettings";
import { lemmatize, getWordMeaning, getWordMeaningEn, findWordFamily, loadBuiltinDictionary, loadBuiltinDictionaryEn } from "@/lib/dictionary";
import { translateWord, translateWordEn, translateSentence } from "@/lib/translate";
import { forceReloadDictionary, lookupExternalDict, lookupExternalDictEn, loadExternalDictionaryEn, type DictLoadStatus } from "@/lib/dictLoader";
import { cleanTranslation, shortenTranslation } from "@/lib/annotationText";
import { processTextToSegmentsAsync } from "@/lib/processBookContent";

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
    openBook,
    closeBook,
    addBookmark,
    removeBookmark,
    globalVocabulary,
    addToGlobalVocabulary,
    removeFromGlobalVocabulary,
    clearGlobalVocabulary,
    mergeGlobalVocabulary,
    mergeBooksFromRemote,
    incrementCorrectCount,
    clearMasteredWords,
    addSentenceAnnotation,
    removeSentenceAnnotation,
    mergeBookProgress,
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
    dictMode,
    setDictMode,
    pageTurnRatio,
    setPageTurnRatio,
    clickToTurnPage,
    setClickToTurnPage,
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
    createSync,
    bindSyncCode,
    syncBoth,
    unbind,
  } = useSync();

  // 同步按钮点击（不切换 tab，只打开弹窗）
  const handleSyncClick = useCallback(() => {
    setSyncPanelOpen(true);
  }, []);

  // Build sync data from current state
  const buildSyncData = useCallback(() => {
    return {
      vocabulary: globalVocabulary,
      bookProgress: books.reduce((acc: Record<string, {
        title: string;
        lastScrollPosition: number;
        lastParagraphIndex: number;
        lastReadAt: number;
        annotations: Record<string, unknown>;
        sentenceAnnotations?: unknown[];
        bookmarks?: unknown[];
      }>, book) => {
        acc[book.id] = {
          title: book.title,
          lastScrollPosition: book.lastScrollPosition || 0,
          lastParagraphIndex: book.lastParagraphIndex || 0,
          lastReadAt: book.lastReadAt,
          annotations: book.annotations,
          sentenceAnnotations: book.sentenceAnnotations || [],
          bookmarks: book.bookmarks || [],
        };
        return acc;
      }, {}),
      // 同步完整书籍内容（不含 processedContent）
      books: books.map(({ processedContent, ...rest }) => rest),
    };
  }, [globalVocabulary, books]);

  // Handle create sync - push current local data to cloud
  const handleCreateSync = useCallback(async () => {
    const data = buildSyncData();
    const code = await createSync(data);
    if (code) {
      console.log('已生成同步码:', code);
      setSyncJustCreated(true);
    }
  }, [buildSyncData, createSync]);

  // Handle bind existing sync code - pull data from cloud and merge
  const handleBindSync = useCallback(async (code: string) => {
    const remoteData = await bindSyncCode(code);
    if (remoteData) {
      // Merge remote vocabulary into local
      if (remoteData.vocabulary) {
        Object.entries(remoteData.vocabulary).forEach(([word, info]) => {
          const existing = globalVocabulary[word];
          // 智能合并：词汇表取并集，count 取较大值
          const infoObj = info as { root?: string; meaning?: string; pos?: string; count?: number } | undefined;
          const existingCount = existing?.correctCount || 0;
          const remoteCount = infoObj?.count || 0;
          if (!existing || remoteCount > existingCount) {
            addToGlobalVocabulary(
              infoObj?.root || word,
              infoObj?.meaning || '',
              infoObj?.pos || ''
            );
          }
        });
      }
      // 进度取较大值，按 bookId 匹配，找不到则按 title 匹配
      if (remoteData.bookProgress) {
        Object.entries(remoteData.bookProgress as Record<string, {
          title?: string;
          lastScrollPosition?: number;
          lastParagraphIndex?: number;
          annotations?: Record<string, unknown>;
          sentenceAnnotations?: unknown[];
          bookmarks?: unknown[];
        }>).forEach(([bookId, progress]) => {
          // 先按 bookId 查找
          let localBook = books.find(b => b.id === bookId);
          // 找不到则按 title 查找
          if (!localBook && progress.title) {
            localBook = books.find(b => b.title === progress.title);
          }
          if (localBook && progress) {
            if ((progress.lastScrollPosition ?? 0) > (localBook.lastScrollPosition ?? 0)) {
              updateScrollPosition(localBook.id, progress.lastScrollPosition ?? 0, progress.lastParagraphIndex ?? 0);
            }
            if (progress.annotations) {
              mergeBookProgress(localBook.id, { 
                annotations: progress.annotations as Parameters<typeof mergeBookProgress>[1]['annotations']
              });
            }
          }
        });
      }
      // 合并远端书籍列表（upsert + 智能合并）
      if (remoteData.books && mergeBooksFromRemote) {
        mergeBooksFromRemote(remoteData.books as import("@/hooks/useBookshelf").Book[]);
      }
    }
  }, [bindSyncCode, globalVocabulary, addToGlobalVocabulary, books, updateScrollPosition, mergeBookProgress, mergeBooksFromRemote]);

  // Handle sync - bidirectional sync (push local then pull merged result)
  const handleSync = useCallback(async () => {
    const remoteData = await syncBoth(buildSyncData());
    if (!remoteData) return;

    // 用服务端合并后的数据更新本地
    if (remoteData.vocabulary) {
      mergeGlobalVocabulary(remoteData.vocabulary);
    }

    if (remoteData.bookProgress) {
      for (const [bookId, progress] of Object.entries(remoteData.bookProgress) as [string, {
        title?: string;
        lastScrollPosition?: number;
        lastParagraphIndex?: number;
        annotations?: Record<string, { root: string; meaning: string; pos: string; count?: number }>;
        sentenceAnnotations?: unknown[];
        bookmarks?: unknown[];
      }][]) {
        // 先按 bookId 查找本地书籍
        let localBook = books.find(b => b.id === bookId);
        // 找不到则按 title 查找
        if (!localBook && progress.title) {
          localBook = books.find(b => b.title === progress.title);
        }
        // 服务端返回的数据已经是合并后的，直接使用
        if (localBook) {
          mergeBookProgress(localBook.id, {
            lastScrollPosition: progress.lastScrollPosition,
            lastParagraphIndex: progress.lastParagraphIndex,
            annotations: progress.annotations,
            sentenceAnnotations: progress.sentenceAnnotations as Parameters<typeof mergeBookProgress>[1]['sentenceAnnotations'],
            bookmarks: progress.bookmarks as Parameters<typeof mergeBookProgress>[1]['bookmarks'],
          });
        }
      }
    }

    // 用服务端合并后的书籍列表更新本地
    if (remoteData.books && mergeBooksFromRemote) {
      mergeBooksFromRemote(remoteData.books as import("@/hooks/useBookshelf").Book[]);
    }
  }, [syncBoth, buildSyncData, books, mergeGlobalVocabulary, mergeBookProgress, mergeBooksFromRemote]);

  // 自动同步专用：仅返回远程数据，不做本地合并（由 hook 调用方决定何时合并）
  // 这里复用 handleSync 的逻辑，但通过回调通知外部有新的远程数据
  const performSyncForPeriodic = useCallback(async () => {
    const remoteData = await syncBoth(buildSyncData());
    if (!remoteData) return null;

    // 复用 handleSync 的合并逻辑
    if (remoteData.vocabulary) {
      mergeGlobalVocabulary(remoteData.vocabulary);
    }

    if (remoteData.bookProgress) {
      for (const [bookId, progress] of Object.entries(remoteData.bookProgress) as [string, {
        title?: string;
        lastScrollPosition?: number;
        lastParagraphIndex?: number;
        annotations?: Record<string, { root: string; meaning: string; pos: string; count?: number }>;
        sentenceAnnotations?: unknown[];
        bookmarks?: unknown[];
      }][]) {
        let localBook = books.find(b => b.id === bookId);
        if (!localBook && progress.title) {
          localBook = books.find(b => b.title === progress.title);
        }
        if (localBook) {
          mergeBookProgress(localBook.id, {
            lastScrollPosition: progress.lastScrollPosition,
            lastParagraphIndex: progress.lastParagraphIndex,
            annotations: progress.annotations,
            sentenceAnnotations: progress.sentenceAnnotations as Parameters<typeof mergeBookProgress>[1]['sentenceAnnotations'],
            bookmarks: progress.bookmarks as Parameters<typeof mergeBookProgress>[1]['bookmarks'],
          });
        }
      }
    }

    if (remoteData.books && mergeBooksFromRemote) {
      mergeBooksFromRemote(remoteData.books as import("@/hooks/useBookshelf").Book[]);
    }

    return remoteData;
  }, [syncBoth, buildSyncData, books, mergeGlobalVocabulary, mergeBookProgress, mergeBooksFromRemote]);

  // 启用自动定时同步（仅前台 + 每小时 + 需 syncCode）
  usePeriodicSync({
    syncCode,
    syncing,
    buildSyncData,
    performSync: performSyncForPeriodic,
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
      console.log('localStorage 使用量:', totalMB, 'MB');
      
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
      console.log("词典加载完成:", { zh: zhStatus, en: enStatus });
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

    // Annotations: compare by reference (immutable updates from useBookshelf)
    if (currentBookAnnotationsRef.current !== currentBook.annotations) {
      currentBookAnnotationsRef.current = currentBook.annotations;
      setAnnotations(currentBook.annotations);
    }

    // Only process segments on first open (bookId change)
    if (lastProcessedBookIdRef.current !== currentBook.id) {
      lastProcessedBookIdRef.current = currentBook.id;
      setLoading(true);

      const savedScrollPercent = currentBook.lastScrollPosition || 0;
      const savedParagraphIndex = currentBook.lastParagraphIndex ?? -1;

      processTextToSegmentsAsync(currentBook.content).then((processed) => {
        setProcessedContent(processed);
        setLoading(false);

        let savedParagraphText = "";
        if (savedParagraphIndex >= 0 && savedParagraphIndex < processed.length) {
          savedParagraphText = processed[savedParagraphIndex].segments
            .map((s) => s.text)
            .join("")
            .substring(0, 80);
        }
        setCurrentParagraphText(savedParagraphText);
      });
    }
  }, [currentBook?.id, currentBook?.content, currentBook?.annotations]);

  // Effect-sidebar: restore sidebar open state when book changes
  useEffect(() => {
    if (!currentBook) {
      setSidebarOpen(false);
      return;
    }
    const shouldOpen = getSidebarState(currentBook.id);
    setSidebarOpen(shouldOpen);
  }, [currentBook?.id, getSidebarState]);  // Handle sidebar toggle with localStorage memory
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
  const [currentParagraphText, setCurrentParagraphText] = useState("");  // 新增这一行
  const [currentChapterTitle, setCurrentChapterTitle] = useState("");


  
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
        console.log('保存保护期结束');
      }, 3000);
    }
    return () => {
      if (initTimerRef.current) clearTimeout(initTimerRef.current);
    };
  }, [currentBook?.id]);

  useEffect(() => {
    const bookId = currentBookIdRef.current;
    if (!bookId) return;
    if (!hasInitializedRef.current) return;
    if (currentScrollPercent === 0 && currentParagraphIndex <= 0) return;

    const timeout = setTimeout(() => {
      updateScrollPosition(bookId, currentScrollPercent, currentParagraphIndex);
      console.log('已保存: percent=', currentScrollPercent, ', idx=', currentParagraphIndex, ', text=', currentParagraphText.substring(0, 30));
    }, 1000);

    return () => clearTimeout(timeout);
  }, [currentScrollPercent, currentParagraphIndex, updateScrollPosition]);





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

  // Save annotations when they change
  useEffect(() => {
    const bookId = currentBookIdRef.current;
    if (bookId) {
      updateBookAnnotations(bookId, annotations);
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
        setSelectedWord({
          word: cleanWord,
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
        updateBookAnnotations(currentBook!.id, {
          ...annotations,
          [root]: newAnnotation,
        });
        addToGlobalVocabulary(root, shortMeaning, "");
      }
    },
    [annotations, currentBook, dictMode, updateBookAnnotations, addToGlobalVocabulary]
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
  const removeAnnotation = useCallback((word: string) => {
    const root = lemmatize(word.toLowerCase());
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
      // 获取选区在屏幕上的位置
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
    isProgrammaticScrollRef.current = true;
    lastProcessedBookIdRef.current = null;
    closeBook();
    setText("");
    setAnnotations({});
    setSelectedWord(null);
    setProcessedContent(null);
    setSettingsPanelOpen(false);
  }, [closeBook]);

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
        books={books}
        getProgress={getProgress}
        formatLastRead={formatLastRead}
        addBook={addBook}
        deleteBook={deleteBook}
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
