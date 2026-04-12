"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Bookshelf } from "@/components/Bookshelf";
import { ReadingArea, type ReadingAreaRef } from "@/components/ReadingArea";
import { WordTooltip } from "@/components/WordTooltip";
import { VocabularySidebar } from "@/components/VocabularySidebar";
import { GlobalVocabularyPage } from "@/components/GlobalVocabularyPage";
import { SettingsPanel } from "@/components/SettingsPanel";
import { ExportImportModal } from "@/components/ExportImportModal";
import JSLibLoader from "@/components/JSLibLoader";
import { useBookshelf, ProcessedContent, ProcessedSegment, ProcessedParagraph } from "@/hooks/useBookshelf";
import { useReadingSettings } from "@/hooks/useReadingSettings";
import { lemmatize, getWordMeaning, getWordMeaningEn, findWordFamily, loadBuiltinDictionary, loadBuiltinDictionaryEn } from "@/lib/dictionary";
//import { translateWord, translateWordEn } from "@/lib/translate";
//import { forceReloadDictionary, lookupExternalDict, lookupExternalDictEn, loadExternalDictionaryEn, type DictLoadStatus } from "@/lib/dictLoader";
import { translateWord, translateWordEn } from "@/lib/translate";
import { forceReloadDictionary, lookupExternalDict, lookupExternalDictEn, loadExternalDictionaryEn, type DictLoadStatus } from "@/lib/dictLoader";


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

/**
 * Shorten translation text - keep only 1-2 most concise meanings
 * This is used to prevent overly long annotations like "(会话说话交谈)"
 * @param text - The translation text
 * @param mode - 'zh' for Chinese mode, 'en' for English mode
 */
function shortenTranslation(text: string, mode: 'zh' | 'en' = 'zh'): string {
  if (!text) return mode === 'en' ? 'No definition' : '未知';
  
  // First, clean the text (remove POS tags, brackets, etc.)
  let cleaned = text;
  cleaned = cleaned.replace(/^[a-z]+\.(?:\/[a-z]+\.)*\s*/gi, '');
  cleaned = cleaned.replace(/^(名词|动词|形容词|副词|介词|连词|代词|冠词|感叹词|数词|前缀|后缀)[;；\s]*/g, '');
  cleaned = cleaned.replace(/^[.。:：]+/, '');
  cleaned = cleaned.replace(/\[[^\]]+\]/g, '');
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/^[，。、；：.!?,]+/, '').replace(/[，。、；：.!?,]+$/, '');
  cleaned = cleaned.trim();
  
  if (!cleaned) return mode === 'en' ? 'No definition' : '未知';
  
  if (mode === 'en') {
    // English mode: simpler processing, just truncate
    // Split by semicolons or commas
    let items = cleaned.split(/[;,]/).map(s => s.trim()).filter(s => s.length > 0);
    
    // Take first 2 items, max 40 chars each
    items = items.slice(0, 2).map(s => {
      if (s.length > 40) {
        return s.substring(0, 40).trim() + '...';
      }
      return s;
    });
    
    return items.length > 0 ? items.join('; ') : 'No definition';
  }
  
  // Chinese mode (original logic)
  // Split by various separators first
  let items = cleaned.split(/[;；,，、/\n\\n]+/);
  
  // If only one item and it's all Chinese with no separators, smart split it
  if (items.length === 1 && /^[\u4e00-\u9fff]+$/.test(items[0])) {
    const str = items[0];
    // Split by common word boundaries (2-4 chars each)
    const newItems: string[] = [];
    for (let i = 0; i < str.length; i += 2) {
      newItems.push(str.substring(i, Math.min(i + 3, str.length)));
    }
    items = newItems;
  }
  
  // Clean each item and filter: must have Chinese characters, max 6 chars each
  items = items
    .map(s => s.trim())
    .filter(s => s.length > 0 && s.length <= 6)
    .filter(s => /[\u4e00-\u9fff]/.test(s));
  
  // Take first 2 items
  items = items.slice(0, 2);
  
  if (items.length === 0) {
    // Fallback: be more lenient, just take first 2 parts and extract Chinese
    const parts = cleaned.split(/[;；,，、/\n\\n]+/);
    items = parts
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .slice(0, 2);
    // Extract Chinese characters only, max 4 chars each
    items = items.map(s => {
      const chinese = s.replace(/[^\u4e00-\u9fff]/g, '');
      return chinese.substring(0, 4);
    }).filter(s => s.length > 0);
  }
  
  return items.length > 0 ? items.join(',') : '未知';
}

// Process text into structured segments with lemmas
// Handles EPUB heading markers like [H2]Chapter 1[/H2]
async function processTextToSegmentsAsync(text: string | undefined | null): Promise<ProcessedContent> {
  if (!text) return [];
  
  const rawParagraphs = text.split(/\n\n+/).filter(p => p.trim());
  const result: ProcessedParagraph[] = [];
  const CHUNK_SIZE = 100;
  
  for (let i = 0; i < rawParagraphs.length; i++) {
    const trimmed = rawParagraphs[i].trim();
    if (!trimmed) continue;
    
    const headingMatch = trimmed.match(/^\[H(\d)\]([\s\S]*?)\[\/H\d\]$/);
    
    if (headingMatch) {
      const level = parseInt(headingMatch[1], 10);
      const headingText = headingMatch[2].trim();
      
      if (headingText) {
        const segments: ProcessedSegment[] = [];
        const regex = /([a-zA-Z]+|[^a-zA-Z\s]+|\s+)/g;
        let segMatch;
        
        while ((segMatch = regex.exec(headingText)) !== null) {
          const token = segMatch[0];
          if (/^\s+$/.test(token)) {
            segments.push({ text: token, lemma: "", type: "space" });
          } else if (/^[a-zA-Z]+$/.test(token)) {
            segments.push({ text: token, lemma: lemmatize(token.toLowerCase()), type: "word" });
          } else {
            segments.push({ text: token, lemma: "", type: "punctuation" });
          }
        }
        
        result.push({ segments, headingLevel: level });
      }
    } else {
      const segments: ProcessedSegment[] = [];
      const regex = /([a-zA-Z]+|[^a-zA-Z\s]+|\s+)/g;
      let segMatch;
      
      while ((segMatch = regex.exec(trimmed)) !== null) {
        const token = segMatch[0];
        if (/^\s+$/.test(token)) {
          segments.push({ text: token, lemma: "", type: "space" });
        } else if (/^[a-zA-Z]+$/.test(token)) {
          segments.push({ text: token, lemma: lemmatize(token.toLowerCase()), type: "word" });
        } else {
          segments.push({ text: token, lemma: "", type: "punctuation" });
        }
      }
      
      result.push({ segments });
    }
    
    if (i > 0 && i % CHUNK_SIZE === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  return result;
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
    openBook,
    closeBook,
    addBookmark,
    removeBookmark,
    globalVocabulary,
    addToGlobalVocabulary,
    removeFromGlobalVocabulary,
    clearGlobalVocabulary,
    mergeGlobalVocabulary,
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
  const tocListRef = useRef<HTMLDivElement>(null);
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
  const [activeTab, setActiveTab] = useState<'bookshelf' | 'vocabulary'>('bookshelf');

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


  // Sync refs when currentBook changes
  useEffect(() => {
    if (currentBook) {
      currentBookIdRef.current = currentBook.id;
      
      if (currentBookContentRef.current !== currentBook.content) {
        currentBookContentRef.current = currentBook.content;
        setText(currentBook.content);
      }
      if (JSON.stringify(currentBookAnnotationsRef.current) !== JSON.stringify(currentBook.annotations)) {
        currentBookAnnotationsRef.current = currentBook.annotations;
        setAnnotations(currentBook.annotations);
      }
      
      // 只在第一次打开这本书时处理内容和恢复位置
      if (lastProcessedBookIdRef.current !== currentBook.id) {
        lastProcessedBookIdRef.current = currentBook.id;
        
        setLoading(true);

        // 把全局词汇表的词合并到当前书的标注中
        const mergedAnnotations = { ...currentBook.annotations };
        let hasNewWords = false;
        for (const [root, vocab] of Object.entries(globalVocabulary)) {
          if (!mergedAnnotations[root]) {
            const family = findWordFamily(root, currentBook.content);
            if (family.length > 0) {
              mergedAnnotations[root] = {
                root: vocab.root,
                meaning: vocab.meaning,
                pos: vocab.pos,
                count: family.length,
              };
              hasNewWords = true;
            }
          }
        }
        if (hasNewWords) {
          setAnnotations(mergedAnnotations);
          updateBookAnnotations(currentBook.id, mergedAnnotations);
        }

        console.log('打开书籍 lastScrollPosition:', currentBook.lastScrollPosition);

        
        const savedScrollPercent = currentBook.lastScrollPosition || 0;
        const savedParagraphIndex = currentBook.lastParagraphIndex ?? -1;
        
        processTextToSegmentsAsync(currentBook.content).then((processed) => {
          setProcessedContent(processed);
          setLoading(false);
          
          // 提取保存索引处的段落文字作为锚点
          let savedParagraphText = "";
          if (savedParagraphIndex >= 0 && savedParagraphIndex < processed.length) {
            savedParagraphText = processed[savedParagraphIndex].segments.map(s => s.text).join('').substring(0, 80);
          }
          setCurrentParagraphText(savedParagraphText);
          
          console.log('恢复位置数据: paragraphIndex=', savedParagraphIndex, ', scrollPercent=', savedScrollPercent, '%, text=', savedParagraphText.substring(0, 30));
        });

        setSidebarOpen(false);
      }
      
    } else {
      currentBookIdRef.current = null;
      currentBookContentRef.current = "";
      currentBookAnnotationsRef.current = {};
      lastProcessedBookIdRef.current = null;
      setProcessedContent(null);
      setLoading(false);
      setSidebarOpen(false);
    }
  }, [currentBook, getSidebarState, globalVocabulary, updateBookAnnotations]);



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
        {/* 主内容区域 */}
        {activeTab === 'bookshelf' ? (
          <>
            <Bookshelf
              books={books}
              getProgress={getProgress}
              formatLastRead={formatLastRead}
              onAddBook={addBook}
              onDeleteBook={deleteBook}
              onOpenBook={openBook}
              onDataManageClick={() => setDataManageOpen(true)}
            />
            <ExportImportModal
              open={dataManageOpen}
              onOpenChange={setDataManageOpen}
              globalVocabulary={globalVocabulary}
              onMergeGlobalVocabulary={mergeGlobalVocabulary}
              books={books}
            />
          </>
        ) : (
          <GlobalVocabularyPage
            vocabulary={globalVocabulary}
            onRemoveWord={removeFromGlobalVocabulary}
            onClearAll={clearGlobalVocabulary}
            backgroundColor={backgroundColor}
          />
        )}

        {/* 底部工具栏 */}
        <div className="bottom-tab-bar">
          <button
            className={`tab-bar-item ${activeTab === 'bookshelf' ? 'active' : ''}`}
            onClick={() => setActiveTab('bookshelf')}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <span>书架</span>
          </button>
          <button
            className={`tab-bar-item ${activeTab === 'vocabulary' ? 'active' : ''}`}
            onClick={() => setActiveTab('vocabulary')}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            <span>词汇表</span>
            {Object.keys(globalVocabulary).length > 0 && (
              <span className="tab-bar-badge">{Object.keys(globalVocabulary).length}</span>
            )}
          </button>
        </div>

        <style jsx>{`
          .bookshelf-page {
            min-height: 100vh;
            min-height: 100dvh;
            padding-bottom: 70px;
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

          .bottom-tab-bar {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 60px;
            background: white;
            border-top: 1px solid #e8e8e8;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0;
            z-index: 500;
            padding-bottom: env(safe-area-inset-bottom, 0);
            box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
          }

          .tab-bar-item {
            flex: 1;
            max-width: 160px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 3px;
            padding: 8px 0;
            background: none;
            border: none;
            cursor: pointer;
            color: #999;
            font-size: 11px;
            font-weight: 500;
            transition: color 0.15s ease;
            position: relative;
          }

          .tab-bar-item:hover {
            color: #666;
          }

          .tab-bar-item.active {
            color: #4a90d9;
          }

          .tab-bar-item.active svg {
            stroke: #4a90d9;
          }

          .tab-bar-badge {
            position: absolute;
            top: 4px;
            right: calc(50% - 26px);
            background: #e74c3c;
            color: white;
            font-size: 10px;
            font-weight: 600;
            min-width: 18px;
            height: 18px;
            border-radius: 9px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0 5px;
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
        dictMode={dictMode}
        onDictModeChange={setDictMode}
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
            <div className="toc-list" ref={tocListRef}>
              {currentBook?.tableOfContents && currentBook.tableOfContents.length > 0 ? (
                <>
                  {/* 排序按钮 */}
                  <div style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    padding: "8px 12px",
                    borderBottom: `1px solid ${isDarkMode ? "#333" : "#eee"}`,
                  }}>
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
                  {/* 目录列表 */}
                  {(tocReversed ? [...currentBook.tableOfContents].reverse() : currentBook.tableOfContents).map((entry, index) => {
                    // 判断是否是当前章节
                    const originalIndex = tocReversed ? currentBook.tableOfContents!.length - 1 - index : index;
                    const nextEntry = currentBook.tableOfContents![originalIndex + 1];
                    const isActive = entry.paragraphIndex !== undefined &&
                      entry.paragraphIndex <= currentParagraphIndex &&
                      (nextEntry === undefined || nextEntry.paragraphIndex === undefined || nextEntry.paragraphIndex > currentParagraphIndex);

                    return (
                      <button
                        key={originalIndex}
                        className={`toc-item ${isActive ? 'toc-active' : ''}`}
                        onClick={() => {
                          if (entry.paragraphIndex !== undefined) {
                            goToParagraph(entry.paragraphIndex);
                          } else {
                            readingAreaRef.current?.restoreScrollPosition(entry.page);
                          }
                        }}
                        style={{
                          color: isActive ? (isDarkMode ? "#6ba3e0" : "#4a90d9") : (isDarkMode ? "#ccc" : "#333"),
                          fontWeight: isActive ? 600 : 400,
                          backgroundColor: isActive ? (isDarkMode ? "rgba(74,144,217,0.1)" : "rgba(74,144,217,0.08)") : "transparent",
                        }}
                      >
                        {entry.title}
                      </button>
                    );
                  })}

                  {/* 到底部按钮 */}
                  {currentBook?.tableOfContents && currentBook.tableOfContents.length > 10 && (
                    <button
                      className="toc-scroll-bottom-btn"
                      onClick={() => {
                        if (tocListRef.current) {
                          tocListRef.current.scrollTo({
                            top: tocListRef.current.scrollHeight,
                            behavior: 'smooth',
                          });
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
                    {currentBook.bookmarks.some(bm => bm.page === currentScrollPercent) ? "移除当前位置书签" : "添加当前位置书签"}
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
      {/* 标注进度条 - 顶部加载条 */}
      {annotating && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: 'rgba(0,0,0,0.05)',
          zIndex: 9999,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: '30%',
            background: 'linear-gradient(90deg, #4a90d9, #6ba3e0, #4a90d9)',
            borderRadius: '0 2px 2px 0',
            animation: 'topBarSlide 1.2s ease-in-out infinite',
          }} />
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
          
          {/* TOC Button - Hidden on mobile */}
          <button 
            className={`toc-btn nav-btn-catalog ${isDarkMode ? 'dark' : ''}`}
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
          
          <span style={{
            flex: 1,
            textAlign: "center",
            fontSize: "14px",
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            padding: "0 8px",
          }}>
            {currentChapterTitle || currentBook.title}
          </span>
        </div>
        
        <div className="header-right">
          {/* Search Button */}
          <button
            className={`search-btn ${isDarkMode ? "dark" : ""}`}
            onClick={() => {
              setSearchOpen(!searchOpen);
              if (!searchOpen) {
                setTimeout(() => searchInputRef.current?.focus(), 50);
              }
            }}
            title="搜索全文 (Ctrl+F)"
            style={{ 
              backgroundColor: searchOpen ? (isDarkMode ? "#3a3a4e" : "#e0e0e0") : "transparent",
              borderColor: isDarkMode ? "#444" : "#ddd",
              color: headerTextColor,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>

          {/* More Menu Button - Only visible on mobile */}
          <button
            className={`more-menu-btn nav-btn-more ${isDarkMode ? "dark" : ""}`}
            onClick={() => setMoreMenuOpen(!moreMenuOpen)}
            title="更多"
            style={{ 
              backgroundColor: moreMenuOpen ? (isDarkMode ? "#3a3a4e" : "#e0e0e0") : "transparent",
              borderColor: isDarkMode ? "#444" : "#ddd",
              color: headerTextColor,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="1" />
              <circle cx="19" cy="12" r="1" />
              <circle cx="5" cy="12" r="1" />
            </svg>
          </button>

          {/* Settings Button - Hidden on mobile */}
          <button
            className="settings-btn nav-btn-font"
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

          {/* Bookmark Button - Hidden on mobile */}
          <button
            className={`bookmark-btn nav-btn-bookmark ${isDarkMode ? 'dark' : ''}`}
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
              fill={currentBook?.bookmarks?.some(bm => bm.page === currentScrollPercent) ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
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
            className={`sidebar-toggle nav-btn-vocab ${isDarkMode ? "dark" : ""}`}
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

      {/* Mobile More Menu Dropdown */}
      {moreMenuOpen && (
        <>
          <div className="more-menu-overlay" onClick={() => setMoreMenuOpen(false)} />
          <div className={`more-menu-dropdown ${isDarkMode ? 'dark' : ''}`} style={{ backgroundColor: isDarkMode ? "#2a2a3e" : "#ffffff" }}>
            <button
              className="more-menu-item"
              onClick={() => {
                handleTocClick();
                setMoreMenuOpen(false);
              }}
              style={{ color: isDarkMode ? "#ccc" : "#333" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              <span>目录</span>
            </button>
            <button
              className="more-menu-item"
              onClick={() => {
                setSettingsPanelOpen(!settingsPanelOpen);
                setMoreMenuOpen(false);
              }}
              style={{ color: isDarkMode ? "#ccc" : "#333" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              <span>字体设置</span>
            </button>
            <button
              className="more-menu-item"
              onClick={() => {
                handleBookmarkClick();
                setMoreMenuOpen(false);
              }}
              style={{ color: isDarkMode ? "#ccc" : "#333" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill={currentBook?.bookmarks?.some(bm => bm.page === currentScrollPercent) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              <span>书签</span>
            </button>
            <button
              className="more-menu-item"
              onClick={() => {
                handleSidebarToggle();
                setMoreMenuOpen(false);
              }}
              style={{ color: isDarkMode ? "#ccc" : "#333" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="15" y1="3" x2="15" y2="21" />
              </svg>
              <span>词汇表</span>
            </button>
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
              style={{
                color: headerTextColor,
              }}
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
              style={{
                color: headerTextColor,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            <button
              className={`search-close-btn ${isDarkMode ? "dark" : ""}`}
              onClick={closeSearch}
              title="关闭 (ESC)"
              style={{
                color: headerTextColor,
              }}
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
          {/* Loading overlay for processing large books */}
          {loading && (
            <div className="loading-overlay">
              <div className="loading-spinner"></div>
              <div style={{ color: '#666', fontSize: '14px' }}>正在处理文本...</div>
            </div>
          )}
<ReadingArea
  ref={readingAreaRef}
  text={text}
  processedContent={processedContent}
  annotations={annotations}
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
	onParagraphIndexChange={(index) => {
	  setCurrentParagraphIndex(index);
	  // 同时保存该段落的前80个字符作为锚点
	  if (processedContent && index >= 0 && index < processedContent.length) {
	    const paraText = processedContent[index].segments.map(s => s.text).join('').substring(0, 80);
	    setCurrentParagraphText(paraText);
	  }
	  // 根据当前段落索引，从目录中找到当前章节
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
  initialParagraphText={currentParagraphText}
  initialScrollPercent={currentBook?.lastScrollPosition || 0}
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
  isAnnotated={!!annotations[lemmatize(selectedWord.word.toLowerCase())]}
  annotation={annotations[lemmatize(selectedWord.word.toLowerCase())] || null}
  dictMode={dictMode}
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

        .search-btn {
          padding: 8px 12px;
          border: 1px solid;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .search-btn:hover {
          filter: brightness(0.95);
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
          white-space: nowrap;
          min-width: 100px;
          text-align: center;
        }

        .search-nav-btn {
          padding: 6px 10px;
          border: 1px solid;
          border-radius: 6px;
          background: transparent;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .search-nav-btn:hover:not(:disabled) {
          filter: brightness(0.9);
        }

        .search-nav-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .search-close-btn {
          padding: 6px 10px;
          border: none;
          border-radius: 6px;
          background: transparent;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .search-close-btn:hover {
          filter: brightness(0.9);
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
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

        .toc-item.toc-active {
          border-left: 3px solid #4a90d9;
        }

        .toc-scroll-bottom-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: calc(100% - 24px);
          margin: 12px auto;
          padding: 10px 0;
          border: 1px solid;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: opacity 0.15s ease;
          position: sticky;
          bottom: 8px;
          z-index: 10;
          box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.06);
        }

        .toc-scroll-bottom-btn:hover {
          opacity: 0.8;
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
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .reading-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
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

        /* Full-screen loading overlay for processing large books */
        .reading-container > .loading-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          transform: none;
          background: rgba(255, 248, 240, 0.95);
          border-radius: 0;
          box-shadow: none;
          justify-content: center;
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

        /* Mobile Navigation - Hide buttons on mobile */
        @media (max-width: 768px) {
          .nav-btn-catalog,
          .nav-btn-font,
          .nav-btn-bookmark,
          .nav-btn-vocab {
            display: none !important;
          }
          
          .nav-btn-more {
            display: flex !important;
          }

          .app-title {
            max-width: 120px;
            font-size: 14px;
          }

          .header-stats {
            display: none;
          }

          .dict-status span {
            display: none;
          }

          .app-header {
            padding: 8px 12px;
          }
        }

        /* PC Navigation - Hide more menu */
        @media (min-width: 769px) {
          .nav-btn-more {
            display: none !important;
          }
        }

        /* More Menu Dropdown */
        .more-menu-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.3);
          z-index: 100;
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

        .more-menu-dropdown.dark {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
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
      `}</style>
    </div>
  );
}
