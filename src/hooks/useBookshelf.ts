"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { idbGet, idbSet } from "@/lib/storage";
import {
  BOOKS_MANIFEST_KEY,
  deleteBookContent,
  loadBookContent,
  migrateInlineContentToPerBook,
  saveBookContent,
  toManifestBook,
} from "@/lib/bookContentStorage";
import { removeProcessedContentCacheForBook } from "@/lib/processedContentCache";
import { isTranslationError } from "@/lib/translate";

// Processed content segment type
export interface ProcessedSegment {
  text: string;
  lemma: string;
  type: "word" | "space" | "punctuation";
}

// Processed paragraph type
export interface ProcessedParagraph {
  segments: ProcessedSegment[];
  headingLevel?: number; // 1-6 for headings, undefined for regular paragraphs
}

// Processed content: array of paragraphs
export type ProcessedContent = ProcessedParagraph[];

// TOC Entry
export interface TocEntry {
  title: string;
  href: string;
  page: number;
  paragraphIndex?: number; // The paragraph index this TOC entry corresponds to
}

// Bookmark Entry
export interface BookmarkEntry {
  id: string;
  page: number;
  previewText: string;
  createdAt: number;
}

// Sentence Annotation - for AI translation of selected text
export interface SentenceAnnotation {
  id: string;
  startParagraphIndex: number;
  startCharIndex: number;
  endParagraphIndex: number;
  endCharIndex: number;
  originalText: string;
  translation: string;
  type?: "translation" | "note";
  createdAt: number;
}

export interface Book {
  id: string;
  title: string;
  /** 上次成功同步后本地正文的 SHA-256；一致时可省略正文上传 */
  syncContentHash?: string;
  content: string;
  /** 未加载正文时的字符数（用于预估，不必读 IDB） */
  contentCharLength?: number;
  annotations: Record<string, { root: string; meaning: string; pos: string; count: number }>;
  sentenceAnnotations?: SentenceAnnotation[];
  createdAt: number;
  lastReadAt: number;
  isSample: boolean;
  lastScrollPosition?: number;
  lastParagraphIndex?: number;
  lastParagraphText?: string;
  lastParagraphOffsetRatio?: number;
  lastReadPage?: number;
  processedContent?: ProcessedContent;
  tableOfContents?: TocEntry[]; // Extracted TOC from EPUB
  bookmarks?: BookmarkEntry[]; // User bookmarks
}

/** 同步后因「同书名、不同 bookId」会在云端与本地各保留一条；用于折叠重复的键 */
function normalizeBookTitleForDedupe(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

function mergeTwoBookRecords(a: Book, b: Book): Book {
  const merged: Book = { ...a };
  const ac = a.content || "";
  const bc = b.content || "";
  merged.content = bc.length >= ac.length ? b.content : a.content;
  merged.lastScrollPosition = Math.max(a.lastScrollPosition ?? 0, b.lastScrollPosition ?? 0);
  merged.lastParagraphIndex = Math.max(a.lastParagraphIndex ?? 0, b.lastParagraphIndex ?? 0);
  const moreRecent = (a.lastReadAt || 0) >= (b.lastReadAt || 0) ? a : b;
  merged.lastParagraphOffsetRatio = moreRecent.lastParagraphOffsetRatio ?? 0;
  merged.lastParagraphText = moreRecent.lastParagraphText;
  merged.lastReadAt = Math.max(a.lastReadAt || 0, b.lastReadAt || 0);
  merged.annotations = { ...(a.annotations || {}), ...(b.annotations || {}) };

  const sA = a.sentenceAnnotations || [];
  const sB = b.sentenceAnnotations || [];
  if (sB.length > 0) {
    const ids = new Set(sA.map((s) => s.id));
    merged.sentenceAnnotations = [...sA, ...sB.filter((s) => !ids.has(s.id))];
  } else {
    merged.sentenceAnnotations = sA.length ? [...sA] : undefined;
  }

  const bmA = a.bookmarks || [];
  const bmB = b.bookmarks || [];
  if (bmB.length > 0) {
    const ids = new Set(bmA.map((x) => x.id));
    merged.bookmarks = [...bmA, ...bmB.filter((x) => !ids.has(x.id))];
  } else {
    merged.bookmarks = bmA.length ? [...bmA] : undefined;
  }

  if (b.title && !a.title) merged.title = b.title;
  if (b.tableOfContents && !a.tableOfContents) merged.tableOfContents = b.tableOfContents;

  return merged;
}

/**
 * 云端 merge 曾为同书名不同 id 存两份正文；拉取后按书名合并为一本。
 * preferExistingIds：优先保留当前书架已有 id，减少点击记录错位。
 */
function dedupeBooksByNormalizedTitle(books: Book[], preferExistingIds: Set<string>): Book[] {
  const samples = books.filter((b) => b.isSample);
  const nonSample = books.filter((b) => !b.isSample);

  const groups = new Map<string, Book[]>();
  for (const book of nonSample) {
    const n = normalizeBookTitleForDedupe(book.title || "");
    const groupKey = n.length > 0 ? n : `__empty_title__${book.id}`;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey)!.push(book);
  }

  const folded: Book[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      folded.push(group[0]);
      continue;
    }
    let merged = group[0];
    for (let i = 1; i < group.length; i++) {
      merged = mergeTwoBookRecords(merged, group[i]);
    }
    const preferred =
      group.find((bk) => preferExistingIds.has(bk.id)) ??
      group.reduce((best, cur) =>
        (cur.lastReadAt || 0) > (best.lastReadAt || 0) ? cur : best
      );
    folded.push({ ...merged, id: preferred.id });
  }

  const combined = [...folded, ...samples];
  combined.sort((a, b) => {
    if (a.isSample && !b.isSample) return 1;
    if (!a.isSample && b.isSample) return -1;
    return b.lastReadAt - a.lastReadAt;
  });
  return combined;
}

const STORAGE_KEY = BOOKS_MANIFEST_KEY;
const GLOBAL_VOCAB_KEY = "english-reader-global-vocabulary";
const MASTERED_WORDS_KEY = "english-reader-mastered-words";
const MASTERED_VOCAB_KEY = "english-reader-mastered-vocabulary";
const SAMPLE_BOOK: Book = {
  id: "sample-book-1",
  title: "The Art of Learning",
  content: `The Art of Learning

Every day presents us with countless opportunities to learn something new. Whether we realize it or not, learning is an essential part of human existence. From the moment we are born, we begin a journey of discovery that continues throughout our lives.

Children are natural learners. They ask questions about everything they see and touch. They experiment with objects, trying to understand how the world works. When they drop a toy, they watch it fall. When they speak, they observe the reactions they receive. This natural curiosity drives them to explore and grow.

As we grow older, however, many of us lose this innate desire to learn. We become comfortable with what we know and resist new ideas. We forget that every person we meet, every experience we have, and every challenge we face has something to teach us.

The truth is that learning never stops. Even when we think we know everything about a subject, there is always more to discover. Scientists spend entire careers studying a single topic and still find new mysteries to explore. Artists dedicate their lives to their craft and continue to develop new techniques and styles.

One of the most important skills we can develop is the ability to learn how to learn. This means understanding our own minds and how we process information. Some people learn best by reading, while others prefer hands-on experience. Some need silence to concentrate, while others work better with background noise.

When we discover our own learning style, we can approach new knowledge more effectively. We can create study habits and environments that help us absorb information more easily. We can be patient with ourselves when we struggle, understanding that mastery takes time.

The benefits of continuous learning extend far beyond simply acquiring new skills. Learning keeps our minds sharp and helps protect against cognitive decline. It opens doors to new opportunities and expands our understanding of the world around us.

Most importantly, learning brings joy and meaning to our lives. There is a special satisfaction in mastering a new subject or understanding a complex idea. The process of learning connects us with others who share our interests and passions.

So whether you are a student in a classroom or an adult pursuing a hobby, remember that learning is a gift you give yourself. Embrace every opportunity to grow, and you will discover a richer, more fulfilling life.`,
  annotations: {},
  createdAt: Date.now(),
  lastReadAt: Date.now(),
  isSample: true,
  lastScrollPosition: 0,
  processedContent: undefined,
  bookmarks: [],
};

const CURRENT_BOOK_KEY = "english-reader-current-book";

export function useBookshelf() {
  const [books, setBooks] = useState<Book[]>([]);
  const [currentBookId, setCurrentBookId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem(CURRENT_BOOK_KEY) || null;
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const [openingBookId, setOpeningBookId] = useState<string | null>(null);

  useEffect(() => {
    if (currentBookId) {
      sessionStorage.setItem(CURRENT_BOOK_KEY, currentBookId);
    } else {
      sessionStorage.removeItem(CURRENT_BOOK_KEY);
    }
  }, [currentBookId]);
const [globalVocabulary, setGlobalVocabulary] = useState<
  Record<string, { root: string; meaning: string; pos: string; correctCount: number; meaningZh?: string; meaningEn?: string; meaningEnSimple?: string }>
>({});
const [masteredVocabulary, setMasteredVocabulary] = useState<
  Record<string, { root: string; meaning: string; pos: string; correctCount: number; meaningZh?: string; meaningEn?: string; meaningEnSimple?: string }>
>({});
// 兼容旧代码：作为派生 Set 暴露
const masteredWords = useMemo(() => new Set(Object.keys(masteredVocabulary)), [masteredVocabulary]);

  const booksRef = useRef(books);
  const currentBookIdRef = useRef(currentBookId);
  useEffect(() => { booksRef.current = books; }, [books]);
  useEffect(() => { currentBookIdRef.current = currentBookId; }, [currentBookId]);

  /**
   * Immediately persist books to IndexedDB.
   * Optionally applies a last-second scroll position update for a given bookId
   * so the state update + IDB write happen atomically (no race condition).
   */
  const flushBooksToStorage = useCallback((pendingScroll?: {
    bookId: string; percent: number; paragraphIndex: number; paragraphText?: string; paragraphOffsetRatio?: number;
  }) => {
    if (typeof window === "undefined") return;
    let snapshot = booksRef.current;
    if (pendingScroll && pendingScroll.bookId) {
      snapshot = snapshot.map((b) =>
        b.id === pendingScroll.bookId
          ? {
              ...b,
              lastScrollPosition: pendingScroll.percent,
              ...(pendingScroll.paragraphIndex >= 0 ? { lastParagraphIndex: pendingScroll.paragraphIndex } : {}),
              ...(pendingScroll.paragraphText ? { lastParagraphText: pendingScroll.paragraphText } : {}),
              ...(pendingScroll.paragraphOffsetRatio !== undefined ? { lastParagraphOffsetRatio: pendingScroll.paragraphOffsetRatio } : {}),
            }
          : b
      );
    }
    const manifest = snapshot.map((book) => toManifestBook(book));
    idbSet(STORAGE_KEY, JSON.stringify(manifest)).catch(() => {});
    for (const book of snapshot) {
      if (book.isSample || !book.content) continue;
      saveBookContent(book.id, book.content).catch(() => {});
    }
  }, []);

  // Load books from IndexedDB (异步加载)
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // 异步加载
    (async () => {
      try {
        const saved = await idbGet(STORAGE_KEY);
        if (saved) {
          try {
            const parsed = JSON.parse(saved) as Book[];
            const manifest = await migrateInlineContentToPerBook(parsed);
            let booksWithMeta = manifest.map((b) => ({
              ...b,
              content: b.isSample ? SAMPLE_BOOK.content : "",
              contentCharLength: b.contentCharLength ?? b.content?.length ?? 0,
              annotations: b.annotations || {},
              bookmarks: b.bookmarks || [],
            }));
            const resumeId =
              typeof window !== "undefined"
                ? sessionStorage.getItem(CURRENT_BOOK_KEY)
                : null;
            if (resumeId) {
              const stored = await loadBookContent(resumeId);
              if (stored !== null) {
                booksWithMeta = booksWithMeta.map((b) =>
                  b.id === resumeId ? { ...b, content: stored, contentCharLength: stored.length } : b,
                );
              }
            }
            const hasSample = booksWithMeta.some((b) => b.id === SAMPLE_BOOK.id);
            const withoutDupes = dedupeBooksByNormalizedTitle(booksWithMeta, new Set());
            if (hasSample) {
              setBooks(withoutDupes);
            } else {
              setBooks([SAMPLE_BOOK, ...withoutDupes]);
            }
          } catch {
            setBooks([SAMPLE_BOOK]);
          }
        } else {
          setBooks([SAMPLE_BOOK]);
        }
      } catch {
        setBooks([SAMPLE_BOOK]);
      }
      // 加载全局词汇表
      try {
        const vocabStr = await idbGet(GLOBAL_VOCAB_KEY);
        if (vocabStr) {
          const parsed = JSON.parse(vocabStr);
          let cleaned = false;
          for (const [key, entry] of Object.entries(parsed) as [string, Record<string, unknown>][]) {
            if (isTranslationError(entry.meaning as string)) { entry.meaning = ''; cleaned = true; }
            if (isTranslationError(entry.meaningZh as string)) { delete entry.meaningZh; cleaned = true; }
            if (isTranslationError(entry.meaningEn as string)) { delete entry.meaningEn; cleaned = true; }
            if (isTranslationError(entry.meaningEnSimple as string)) { delete entry.meaningEnSimple; cleaned = true; }
            if (!entry.meaning && !entry.meaningZh && !entry.meaningEn && !entry.meaningEnSimple) {
              delete parsed[key]; cleaned = true;
            }
          }
          if (cleaned) console.log('[vocab] cleaned error meanings from vocabulary');
          setGlobalVocabulary(parsed);
        }
      } catch {
        console.warn("加载全局词汇表失败");
      }

      try {
        // 优先读新结构（保留释义）
        const mvStr = await idbGet(MASTERED_VOCAB_KEY);
        if (mvStr) {
          const parsed = JSON.parse(mvStr);
          if (parsed && typeof parsed === 'object') {
            setMasteredVocabulary(parsed);
          }
        } else {
          // 旧用户：从字符串数组迁移
          const masteredStr = await idbGet(MASTERED_WORDS_KEY);
          if (masteredStr) {
            const arr = JSON.parse(masteredStr);
            if (Array.isArray(arr)) {
              const migrated: Record<string, { root: string; meaning: string; pos: string; correctCount: number }> = {};
              for (const w of arr) {
                if (typeof w === 'string' && w.trim()) {
                  migrated[w] = { root: w, meaning: '', pos: '', correctCount: 0 };
                }
              }
              setMasteredVocabulary(migrated);
            }
          }
        }
      } catch {
        console.warn("加载已掌握词汇失败");
      }

      setIsLoaded(true);

    })();
  }, []);

  // Save books to IndexedDB (包含 content，只去掉 processedContent)
  useEffect(() => {
    if (!isLoaded || typeof window === "undefined") return;
    
    const timeoutId = setTimeout(() => {
      (async () => {
        try {
          const manifest = books.map((book) => toManifestBook(book));
          await idbSet(STORAGE_KEY, JSON.stringify(manifest));
          await Promise.all(
            books
              .filter((b) => !b.isSample && b.content && b.content.length > 0)
              .map((b) => saveBookContent(b.id, b.content)),
          );
        } catch (error) {
          console.warn("IndexedDB 保存失败:", error);
        }
      })();
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [books, isLoaded]);

    // 保存全局词汇表到 IndexedDB
  useEffect(() => {
    if (!isLoaded || typeof window === "undefined") return;

    const timeoutId = setTimeout(() => {
      (async () => {
        try {
          await idbSet(GLOBAL_VOCAB_KEY, JSON.stringify(globalVocabulary));
        } catch (error) {
          console.warn("保存全局词汇表失败:", error);
        }
      })();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [globalVocabulary, isLoaded]);

  useEffect(() => {
    if (!isLoaded || typeof window === "undefined") return;
    const timeoutId = setTimeout(() => {
      (async () => {
        try {
          await idbSet(MASTERED_VOCAB_KEY, JSON.stringify(masteredVocabulary));
          // 同步写入旧 key，便于旧客户端/同步链路继续可用
          await idbSet(MASTERED_WORDS_KEY, JSON.stringify(Object.keys(masteredVocabulary)));
        } catch (error) {
          console.warn("保存已掌握词汇失败:", error);
        }
      })();
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [masteredVocabulary, isLoaded]);

  // Get current book
  const currentBook = books.find((b) => b.id === currentBookId) || null;

  // Calculate reading progress based on page number
  // Returns percentage (0-100), or -1 if unread
  const getProgress = useCallback((book: Book): number => {
    // 最优先：滚动模式保存的进度，不需要 content
    if (book.lastScrollPosition !== undefined && book.lastScrollPosition > 0) {
      return Math.min(Math.round(book.lastScrollPosition), 100);
    }

    // 没有 content 时无法计算，返回未读
    if (!book.content) return -1;

    // page-based 进度
    if (book.lastReadPage !== undefined && book.lastReadPage > 0) {
      if (book.annotations && Object.keys(book.annotations).length > 0) {
        const paragraphs = book.content.split(/\n\n+/).filter((p) => p.trim().length > 0);
        const totalPages = Math.max(1, Math.ceil(paragraphs.length / 30));
        const progress = Math.min(Math.round((book.lastReadPage / totalPages) * 100), 100);
        return progress;
      }
    }

    // 有标注时根据标注估算
    if (book.annotations && Object.keys(book.annotations).length > 0) {
      const totalWords = book.content.split(/\s+/).filter(Boolean).length;
      if (totalWords === 0) return 0;
      const annotatedCount = Object.keys(book.annotations).reduce(
        (sum, key) => sum + (book.annotations[key]?.count || 1),
        0
      );
      return Math.min(Math.round((annotatedCount / totalWords) * 100), 100);
    }

    return -1;
  }, []);

  // Format last read time
  const formatLastRead = useCallback((timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    if (days < 7) return `${days} 天前`;
    return new Date(timestamp).toLocaleDateString("zh-CN");
  }, []);

  // Add a new book
  const addBook = useCallback(
    (title: string, content: string, tableOfContents?: TocEntry[]): Book => {
      const trimmed = content.trim();
      const newBook: Book = {
        id: `book-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: title.trim() || "未命名书籍",
        content: trimmed,
        contentCharLength: trimmed.length,
        annotations: {},
        createdAt: Date.now(),
        lastReadAt: Date.now(),
        isSample: false,
        bookmarks: [],
        tableOfContents: tableOfContents || [],
      };
      void saveBookContent(newBook.id, trimmed);
      setBooks((prev) => [newBook, ...prev]);
      return newBook;
    },
    []
  );

  // Delete a book (cannot delete sample books)
  const deleteBook = useCallback((id: string) => {
    setBooks((prev) => {
      const book = prev.find((b) => b.id === id);
      if (book?.isSample) return prev; // Cannot delete sample books
      return prev.filter((b) => b.id !== id);
    });
    void removeProcessedContentCacheForBook(id);
    void deleteBookContent(id);
    // If current book is deleted, go back to bookshelf
    if (currentBookId === id) {
      setCurrentBookId(null);
    }
  }, [currentBookId]);

  // Update book annotations
  const updateBookAnnotations = useCallback(
    (id: string, annotations: Record<string, { root: string; meaning: string; pos: string; count: number }>) => {
      setBooks((prev) => {
        const book = prev.find((b) => b.id === id);
        if (book && book.annotations === annotations) return prev;
        return prev.map((b) =>
          b.id === id
            ? { ...b, annotations, lastReadAt: Date.now() }
            : b
        );
      });
    },
    []
  );

  // Update book content
  const updateBookContent = useCallback((id: string, content: string) => {
    void saveBookContent(id, content);
    setBooks((prev) =>
      prev.map((b) =>
        b.id === id
          ? { ...b, content, contentCharLength: content.length, lastReadAt: Date.now() }
          : b
      )
    );
  }, []);

  const updateScrollPosition = useCallback((id: string, position: number, paragraphIndex?: number, paragraphText?: string, paragraphOffsetRatio?: number) => {
    setBooks((prev) =>
      prev.map((b) =>
        b.id === id
          ? { 
              ...b, 
              lastScrollPosition: position,
              ...(paragraphIndex !== undefined && paragraphIndex >= 0 ? { lastParagraphIndex: paragraphIndex } : {}),
              ...(paragraphText !== undefined ? { lastParagraphText: paragraphText } : {}),
              ...(paragraphOffsetRatio !== undefined ? { lastParagraphOffsetRatio: paragraphOffsetRatio } : {}),
            }
          : b
      )
    );
  }, []);


  // Update book read page (for pagination progress tracking)
  const updateReadPage = useCallback((id: string, page: number) => {
    setBooks((prev) =>
      prev.map((b) =>
        b.id === id
          ? { ...b, lastReadPage: page, lastReadAt: Date.now() }
          : b
      )
    );
  }, []);

  // Add a bookmark
  const addBookmark = useCallback((id: string, page: number, previewText: string) => {
    setBooks((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        const bookmarks = b.bookmarks || [];
        // Check if bookmark already exists for this page
        if (bookmarks.some((bm) => bm.page === page)) {
          return b; // Already bookmarked
        }
        const newBookmark: BookmarkEntry = {
          id: `bm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          page,
          previewText: previewText.substring(0, 50),
          createdAt: Date.now(),
        };
        return { ...b, bookmarks: [...bookmarks, newBookmark] };
      })
    );
  }, []);

  // Remove a bookmark
  const removeBookmark = useCallback((id: string, bookmarkId: string) => {
    setBooks((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        const bookmarks = (b.bookmarks || []).filter((bm) => bm.id !== bookmarkId);
        return { ...b, bookmarks };
      })
    );
  }, []);

    // 添加词到全局词汇表（支持多语言释义）
  const addToGlobalVocabulary = useCallback(
    (root: string, meaning: string, pos: string, langs?: { zh?: string; en?: string; enSimple?: string }) => {
      const safeMeaning = isTranslationError(meaning) ? '' : meaning;
      const safeZh = (langs?.zh && !isTranslationError(langs.zh)) ? langs.zh : undefined;
      const safeEn = (langs?.en && !isTranslationError(langs.en)) ? langs.en : undefined;
      const safeEnSimple = (langs?.enSimple && !isTranslationError(langs.enSimple)) ? langs.enSimple : undefined;

      setGlobalVocabulary((prev) => {
        const existing = prev[root];
        const finalMeaning = safeMeaning || existing?.meaning || '';
        if (!finalMeaning && !safeZh && !safeEn && !safeEnSimple && !existing) return prev;
        return {
          ...prev,
          [root]: {
            root,
            meaning: finalMeaning,
            pos,
            correctCount: existing?.correctCount || 0,
            meaningZh: safeZh ?? existing?.meaningZh,
            meaningEn: safeEn ?? existing?.meaningEn,
            meaningEnSimple: safeEnSimple ?? existing?.meaningEnSimple,
          },
        };
      });
      // 该词从已掌握列表移除（如果有）
      setMasteredVocabulary((prev) => {
        if (!prev[root]) return prev;
        const next = { ...prev };
        delete next[root];
        return next;
      });
    },
    []
  );

  // 答对一次，增加 correctCount
  const incrementCorrectCount = useCallback((root: string) => {
    setGlobalVocabulary((prev) => {
      if (!prev[root]) return prev;
      return {
        ...prev,
        [root]: { ...prev[root], correctCount: (prev[root].correctCount || 0) + 1 },
      };
    });
  }, []);

  // 批量清除答对 N 次以上的已掌握单词
  const clearMasteredWords = useCallback((threshold: number) => {
    let removed: Array<[string, typeof globalVocabulary[string]]> = [];
    setGlobalVocabulary((prev) => {
      const next: typeof prev = {};
      removed = [];
      for (const [key, value] of Object.entries(prev)) {
        if ((value.correctCount || 0) < threshold) {
          next[key] = value;
        } else {
          removed.push([key, value]);
        }
      }
      return next;
    });
    if (removed.length > 0) {
      setMasteredVocabulary((prev) => {
        const next = { ...prev };
        for (const [k, v] of removed) {
          if (!next[k]) next[k] = v;
        }
        return next;
      });
    }
  }, []);

  /** 标记为已掌握：若在词汇表中则移出并保留释义；否则写入已掌握列表（可带词典释义） */
  const markWordAsMastered = useCallback((
    root: string,
    supplemental?: {
      meaning?: string;
      pos?: string;
      meaningZh?: string;
      meaningEn?: string;
      meaningEnSimple?: string;
    },
  ) => {
    let preserved: {
      root: string;
      meaning: string;
      pos: string;
      correctCount: number;
      meaningZh?: string;
      meaningEn?: string;
      meaningEnSimple?: string;
    } | null = null;

    setGlobalVocabulary((prev) => {
      const entry = prev[root];
      if (!entry) return prev;
      preserved = entry;
      const next = { ...prev };
      delete next[root];
      return next;
    });

    setMasteredVocabulary((prev) => {
      if (prev[root]) return prev;
      if (preserved) {
        return { ...prev, [root]: preserved };
      }
      const safeMeaning =
        supplemental?.meaning && !isTranslationError(supplemental.meaning)
          ? supplemental.meaning
          : '';
      const safeZh =
        supplemental?.meaningZh && !isTranslationError(supplemental.meaningZh)
          ? supplemental.meaningZh
          : undefined;
      const safeEn =
        supplemental?.meaningEn && !isTranslationError(supplemental.meaningEn)
          ? supplemental.meaningEn
          : undefined;
      const safeEnSimple =
        supplemental?.meaningEnSimple && !isTranslationError(supplemental.meaningEnSimple)
          ? supplemental.meaningEnSimple
          : undefined;
      return {
        ...prev,
        [root]: {
          root,
          meaning: safeMeaning,
          pos: supplemental?.pos ?? '',
          correctCount: 0,
          meaningZh: safeZh,
          meaningEn: safeEn,
          meaningEnSimple: safeEnSimple,
        },
      };
    });
  }, []);

  // 从全局词汇表删除词（标记为已掌握，保留释义到 masteredVocabulary）
  const removeFromGlobalVocabulary = useCallback((root: string) => {
    let preservedEntry: { root: string; meaning: string; pos: string; correctCount: number; meaningZh?: string; meaningEn?: string; meaningEnSimple?: string } | null = null;
    setGlobalVocabulary((prev) => {
      const entry = prev[root];
      if (!entry) return prev;
      preservedEntry = entry;
      const next = { ...prev };
      delete next[root];
      return next;
    });
    setMasteredVocabulary((prev) => {
      if (prev[root]) return prev;
      return {
        ...prev,
        [root]: preservedEntry ?? { root, meaning: '', pos: '', correctCount: 0 },
      };
    });
  }, []);

  // 把已掌握的词恢复回全局词汇表
  const restoreFromMastered = useCallback((root: string) => {
    let entry: { root: string; meaning: string; pos: string; correctCount: number; meaningZh?: string; meaningEn?: string; meaningEnSimple?: string } | null = null;
    setMasteredVocabulary((prev) => {
      const found = prev[root];
      if (!found) return prev;
      entry = found;
      const next = { ...prev };
      delete next[root];
      return next;
    });
    setGlobalVocabulary((prev) => {
      if (!entry) return prev;
      return {
        ...prev,
        [root]: prev[root]
          ? { ...prev[root], ...entry, correctCount: prev[root].correctCount ?? entry.correctCount ?? 0 }
          : { ...entry, correctCount: 0 },
      };
    });
  }, []);

  // 永久从已掌握列表移除（不会再次记入 masteredWords）
  const removeFromMastered = useCallback((root: string) => {
    setMasteredVocabulary((prev) => {
      if (!prev[root]) return prev;
      const next = { ...prev };
      delete next[root];
      return next;
    });
  }, []);

  const clearMasteredVocabulary = useCallback(() => {
    setMasteredVocabulary({});
  }, []);

  // 清空全局词汇表
  const clearGlobalVocabulary = useCallback(() => {
    setGlobalVocabulary({});
  }, []);

  // 合并导入的词汇到全局词汇表（重复替换，不重复追加，保留已有多语言释义）
  const mergeGlobalVocabulary = useCallback(
    (incoming: Record<string, { root: string; meaning: string; pos: string; correctCount?: number; meaningZh?: string; meaningEn?: string; meaningEnSimple?: string }>) => {
      setGlobalVocabulary((prev) => {
        const merged = { ...prev };
        for (const [key, value] of Object.entries(incoming)) {
          const existing = merged[key];
          merged[key] = {
            ...value,
            correctCount: value.correctCount ?? 0,
            meaningZh: value.meaningZh ?? existing?.meaningZh,
            meaningEn: value.meaningEn ?? existing?.meaningEn,
            meaningEnSimple: value.meaningEnSimple ?? existing?.meaningEnSimple,
          };
        }
        return merged;
      });
    },
    []
  );

  // 合并同步数据到书籍（用于从云端拉取合并后的数据）
  const mergeBookProgress = useCallback((
    bookId: string,
    data: {
      lastScrollPosition?: number;
      lastParagraphIndex?: number;
      annotations?: Record<string, { root: string; meaning: string; pos: string; count?: number }>;
      sentenceAnnotations?: SentenceAnnotation[];
      bookmarks?: BookmarkEntry[];
    }
  ) => {
    setBooks((prev) =>
      prev.map((b) => {
        if (b.id !== bookId) return b;
        
        let updated = b;
        
        // 更新阅读进度
        if (data.lastScrollPosition !== undefined && 
            (data.lastScrollPosition > (b.lastScrollPosition ?? 0))) {
          updated = {
            ...updated,
            lastScrollPosition: data.lastScrollPosition,
            lastParagraphIndex: data.lastParagraphIndex ?? b.lastParagraphIndex,
            lastReadAt: Date.now(),
          };
        }
        
        // 合并标注
        if (data.annotations) {
          updated = {
            ...updated,
            annotations: { ...updated.annotations, ...data.annotations } as Record<string, { root: string; meaning: string; pos: string; count: number }>,
          };
        }
        
        // 合并句子标注（按 id 去重）
        if (data.sentenceAnnotations && data.sentenceAnnotations.length > 0) {
          const existingIds = new Set((updated.sentenceAnnotations || []).map(s => s.id));
          const newAnnotations = data.sentenceAnnotations.filter(s => !existingIds.has(s.id));
          updated = {
            ...updated,
            sentenceAnnotations: [...(updated.sentenceAnnotations || []), ...newAnnotations],
          };
        }
        
        // 合并书签（按 id 去重）
        if (data.bookmarks && data.bookmarks.length > 0) {
          const existingIds = new Set((updated.bookmarks || []).map(bm => bm.id));
          const newBookmarks = data.bookmarks.filter(bm => !existingIds.has(bm.id));
          updated = {
            ...updated,
            bookmarks: [...(updated.bookmarks || []), ...newBookmarks],
          };
        }
        
        return updated;
      })
    );
  }, []);

  // 从远端合并书籍列表（upsert + 智能合并）
  // incoming: 来自云端的 Book[]，可能有 content（必有），无 processedContent
  const mergeBooksFromRemote = useCallback(
    (incoming: Book[]) => {
      if (!Array.isArray(incoming) || incoming.length === 0) return;

      setBooks((prev) => {
        // 用 Map 以 id 为 key，便于高效查找
        const booksMap = new Map<string, Book>();
        
        // 先放入当前列表（本地书籍）
        for (const book of prev) {
          booksMap.set(book.id, book);
        }

        // 遍历远端书籍，合并到 Map
        for (const remoteBook of incoming) {
          const existing = booksMap.get(remoteBook.id);

          if (!existing) {
            const remoteContent = remoteBook.content || "";
            if (remoteContent.length > 0) {
              void saveBookContent(remoteBook.id, remoteContent);
            }
            booksMap.set(remoteBook.id, {
              ...remoteBook,
              content: remoteBook.id === currentBookIdRef.current ? remoteContent : "",
              contentCharLength: remoteContent.length || remoteBook.contentCharLength,
              processedContent: undefined,
            });
          } else if (existing.isSample) {
            // 本地示例书，跳过远端同 id 覆盖
            // 保持本地示例书不变
          } else {
            // 本地已存在该书（非示例）：智能合并
            const merged: Book = { ...existing };

            // content：优先保留「非空且更长」的字符串
            const remoteContent = remoteBook.content || '';
            const localContent = existing.content || '';
            const mergedContent = remoteContent.length >= localContent.length
              ? remoteContent
              : localContent;
            if (mergedContent.length > 0) {
              void saveBookContent(existing.id, mergedContent);
            }
            merged.content = existing.id === currentBookIdRef.current ? mergedContent : "";
            merged.contentCharLength = mergedContent.length || existing.contentCharLength;

            merged.lastScrollPosition = Math.max(
              remoteBook.lastScrollPosition ?? 0,
              existing.lastScrollPosition ?? 0
            );
            merged.lastParagraphIndex = Math.max(
              remoteBook.lastParagraphIndex ?? 0,
              existing.lastParagraphIndex ?? 0
            );
            const moreRecentBook = (remoteBook.lastReadAt || 0) >= (existing.lastReadAt || 0) ? remoteBook : existing;
            merged.lastParagraphOffsetRatio = moreRecentBook.lastParagraphOffsetRatio ?? 0;
            merged.lastParagraphText = moreRecentBook.lastParagraphText;

            merged.lastReadAt = Math.max(
              remoteBook.lastReadAt || 0,
              existing.lastReadAt || 0
            );

            // annotations：取并集合并
            merged.annotations = {
              ...(existing.annotations || {}),
              ...(remoteBook.annotations || {}),
            };

            // sentenceAnnotations：按 id 去重追加
            if (remoteBook.sentenceAnnotations && remoteBook.sentenceAnnotations.length > 0) {
              const existingIds = new Set((existing.sentenceAnnotations || []).map(s => s.id));
              const newAnnotations = remoteBook.sentenceAnnotations.filter(s => !existingIds.has(s.id));
              merged.sentenceAnnotations = [
                ...(existing.sentenceAnnotations || []),
                ...newAnnotations,
              ];
            }

            // bookmarks：按 id 去重追加
            if (remoteBook.bookmarks && remoteBook.bookmarks.length > 0) {
              const existingIds = new Set((existing.bookmarks || []).map(b => b.id));
              const newBookmarks = remoteBook.bookmarks.filter(b => !existingIds.has(b.id));
              merged.bookmarks = [
                ...(existing.bookmarks || []),
                ...newBookmarks,
              ];
            }

            // title：远端非空则覆盖空字段
            if (remoteBook.title && !existing.title) {
              merged.title = remoteBook.title;
            }

            // tableOfContents：远端非空则覆盖空字段
            if (remoteBook.tableOfContents && !existing.tableOfContents) {
              merged.tableOfContents = remoteBook.tableOfContents;
            }

            booksMap.set(existing.id, merged);
          }
        }

        // 转换回数组；再按书名折叠同一本书的多份 bookId（云同步历史上会为同书存两条）
        const mergedList = dedupeBooksByNormalizedTitle(
          Array.from(booksMap.values()),
          new Set(prev.map((b) => b.id))
        );

        return mergedList;
      });
    },
    []
  );

  // 添加句子标注
  const addSentenceAnnotation = useCallback(
    (bookId: string, annotation: SentenceAnnotation) => {
      setBooks((prev) =>
        prev.map((b) => {
          if (b.id !== bookId) return b;
          const existing = b.sentenceAnnotations || [];
          return { ...b, sentenceAnnotations: [...existing, annotation] };
        })
      );
    },
    []
  );

  // 删除句子标注
  const removeSentenceAnnotation = useCallback(
    (bookId: string, annotationId: string) => {
      setBooks((prev) =>
        prev.map((b) => {
          if (b.id !== bookId) return b;
          const existing = b.sentenceAnnotations || [];
          return {
            ...b,
            sentenceAnnotations: existing.filter((a) => a.id !== annotationId),
          };
        })
      );
    },
    []
  );


  const renameBook = useCallback((id: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setBooks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, title: trimmed } : b))
    );
  }, []);

  const ensureBookContentLoaded = useCallback(async (id: string): Promise<void> => {
    const book = booksRef.current.find((b) => b.id === id);
    if (!book) return;
    if (book.isSample) {
      if (!book.content) {
        setBooks((prev) =>
          prev.map((b) =>
            b.id === id ? { ...b, content: SAMPLE_BOOK.content, contentCharLength: SAMPLE_BOOK.content.length } : b,
          ),
        );
      }
      return;
    }
    if (book.content && book.content.length > 0) return;
    const stored = await loadBookContent(id);
    if (stored === null) return;
    setBooks((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, content: stored, contentCharLength: stored.length } : b,
      ),
    );
  }, []);

  const resolveBookContent = useCallback(async (id: string): Promise<string> => {
    const book = booksRef.current.find((b) => b.id === id);
    if (book?.isSample) return book.content || SAMPLE_BOOK.content;
    if (book?.content) return book.content;
    const stored = await loadBookContent(id);
    return stored ?? "";
  }, []);

  const openBook = useCallback(async (id: string) => {
    setOpeningBookId(id);
    try {
      await ensureBookContentLoaded(id);
      setBooks((prev) => {
        const now = Date.now();
        return prev.map((b) => {
          if (b.id === id) {
            return { ...b, lastReadAt: now };
          }
          if (!b.isSample && b.content) {
            void saveBookContent(b.id, b.content);
            return {
              ...b,
              content: "",
              contentCharLength: b.content.length || b.contentCharLength,
            };
          }
          return b;
        });
      });
      setCurrentBookId(id);
    } finally {
      setOpeningBookId(null);
    }
  }, [ensureBookContentLoaded]);

  // Close the current book and return to bookshelf
  const closeBook = useCallback(() => {
    const closingId = currentBookId;
    setCurrentBookId(null);
    if (!closingId) return;
    setBooks((prev) =>
      prev.map((b) => {
        if (b.id !== closingId || b.isSample || !b.content) return b;
        void saveBookContent(b.id, b.content);
        return {
          ...b,
          content: "",
          contentCharLength: b.content.length || b.contentCharLength,
        };
      }),
    );
  }, [currentBookId]);

  // Reorder books with new book first
  const reorderBooks = useCallback(() => {
    setBooks((prev) => {
      const sorted = [...prev].sort((a, b) => b.lastReadAt - a.lastReadAt);
      // Keep sample book at the end
      const sample = sorted.find((b) => b.isSample);
      const others = sorted.filter((b) => !b.isSample);
      return sample ? [...others, sample] : sorted;
    });
  }, []);

  /** 同步成功后写入正文哈希，便于下次省略上传未改书籍 */
  const updateBooksSyncHashes = useCallback((hashes: Record<string, string>) => {
    setBooks((prev) =>
      prev.map((b) => {
        const h = hashes[b.id];
        return h !== undefined ? { ...b, syncContentHash: h } : b;
      })
    );
  }, []);

  /**
   * 云端数据整体覆盖本地（时间戳同步策略：云端更新时调用）。
   * 词汇表直接替换；书籍列表直接替换（保留本地 sample book）。
   */
  const replaceAllFromRemote = useCallback((remote: {
    vocabulary?: Record<string, { root: string; meaning: string; pos: string; correctCount?: number; meaningZh?: string; meaningEn?: string; meaningEnSimple?: string }>;
    masteredWords?: string[];
    masteredVocabulary?: Record<string, { root: string; meaning: string; pos: string; correctCount?: number; meaningZh?: string; meaningEn?: string; meaningEnSimple?: string }>;
    books?: Book[];
    bookProgress?: Record<string, unknown>;
  }) => {
    if (remote.vocabulary) {
      const normalized: typeof globalVocabulary = {};
      for (const [k, v] of Object.entries(remote.vocabulary)) {
        normalized[k] = { ...v, correctCount: v.correctCount ?? 0 };
      }
      setGlobalVocabulary(normalized);
    }
    if (remote.masteredVocabulary && typeof remote.masteredVocabulary === 'object') {
      const normalized: typeof masteredVocabulary = {};
      for (const [k, v] of Object.entries(remote.masteredVocabulary)) {
        normalized[k] = { ...v, correctCount: v.correctCount ?? 0 };
      }
      setMasteredVocabulary(normalized);
    } else if (remote.masteredWords && Array.isArray(remote.masteredWords)) {
      // 旧客户端只发了字符串数组：补成空释义记录
      const migrated: typeof masteredVocabulary = {};
      for (const w of remote.masteredWords) {
        if (typeof w === 'string') migrated[w] = { root: w, meaning: '', pos: '', correctCount: 0 };
      }
      setMasteredVocabulary(migrated);
    }

    if (remote.books) {
      const remoteBooks: Book[] = remote.books.map((b) => {
        const remoteContent = b.content || "";
        if (remoteContent.length > 0) {
          void saveBookContent(b.id, remoteContent);
        }
        return {
          ...b,
          content: b.id === currentBookIdRef.current ? remoteContent : "",
          contentCharLength: remoteContent.length || b.contentCharLength,
          processedContent: undefined,
          annotations: (b.annotations ?? {}) as Book['annotations'],
          bookmarks: (b.bookmarks ?? []) as Book['bookmarks'],
        };
      });

      if (remote.bookProgress) {
        for (const rb of remoteBooks) {
          const raw = remote.bookProgress[rb.id];
          const prog = (typeof raw === 'object' && raw !== null ? raw : undefined) as {
            lastScrollPosition?: number;
            lastParagraphIndex?: number;
            lastParagraphText?: string;
            lastParagraphOffsetRatio?: number;
            lastReadAt?: number;
          } | undefined;
          if (prog) {
            rb.lastScrollPosition = prog.lastScrollPosition ?? rb.lastScrollPosition ?? 0;
            rb.lastParagraphIndex = prog.lastParagraphIndex ?? rb.lastParagraphIndex ?? 0;
            if (prog.lastParagraphText) rb.lastParagraphText = prog.lastParagraphText;
            if (prog.lastParagraphOffsetRatio !== undefined) rb.lastParagraphOffsetRatio = prog.lastParagraphOffsetRatio;
            if (prog.lastReadAt) rb.lastReadAt = prog.lastReadAt;
          }
        }
      }

      setBooks((prev) => {
        const sample = prev.find((b) => b.isSample);
        const hasSampleInRemote = remoteBooks.some((b) => b.id === SAMPLE_BOOK.id);
        const base = hasSampleInRemote ? remoteBooks : (sample ? [sample, ...remoteBooks] : remoteBooks);

        // Preserve the currently open book so it's never dropped mid-reading
        if (currentBookId) {
          const inBase = base.some((b) => b.id === currentBookId);
          if (!inBase) {
            const openBook = prev.find((b) => b.id === currentBookId);
            if (openBook) base.push(openBook);
          }
        }

        base.sort((a, b) => {
          if (a.isSample && !b.isSample) return 1;
          if (!a.isSample && b.isSample) return -1;
          return (b.lastReadAt || 0) - (a.lastReadAt || 0);
        });
        return base;
      });
    } else if (remote.bookProgress) {
      setBooks((prev) => prev.map((book) => {
        const raw = remote.bookProgress![book.id];
        const prog = (typeof raw === 'object' && raw !== null ? raw : undefined) as {
          lastScrollPosition?: number;
          lastParagraphIndex?: number;
          lastParagraphText?: string;
          lastParagraphOffsetRatio?: number;
          lastReadAt?: number;
          annotations?: Record<string, unknown>;
          sentenceAnnotations?: unknown[];
          bookmarks?: unknown[];
        } | undefined;
        if (!prog) return book;
        return {
          ...book,
          lastScrollPosition: prog.lastScrollPosition ?? book.lastScrollPosition ?? 0,
          lastParagraphIndex: prog.lastParagraphIndex ?? book.lastParagraphIndex ?? 0,
          lastParagraphText: prog.lastParagraphText ?? book.lastParagraphText,
          lastParagraphOffsetRatio: prog.lastParagraphOffsetRatio ?? book.lastParagraphOffsetRatio,
          lastReadAt: prog.lastReadAt ?? book.lastReadAt,
          annotations: (prog.annotations ?? book.annotations) as Book['annotations'],
          sentenceAnnotations: (prog.sentenceAnnotations ?? book.sentenceAnnotations) as Book['sentenceAnnotations'],
          bookmarks: (prog.bookmarks ?? book.bookmarks) as Book['bookmarks'],
        };
      }));
    }
  }, [globalVocabulary]);

  return {
    books,
    currentBook,
    currentBookId,
    isLoaded,
    openingBookId,
    getProgress,
    formatLastRead,
    addBook,
    deleteBook,
    renameBook,
    updateBookAnnotations,
    updateBookContent,
    updateScrollPosition,
    updateReadPage,
    openBook,
    closeBook,
    reorderBooks,
    addBookmark,
    removeBookmark,
    globalVocabulary,
    masteredWords,
    masteredVocabulary,
    addToGlobalVocabulary,
    removeFromGlobalVocabulary,
    markWordAsMastered,
    restoreFromMastered,
    removeFromMastered,
    clearMasteredVocabulary,
    clearGlobalVocabulary,
    mergeGlobalVocabulary,
    incrementCorrectCount,
    clearMasteredWords,
    addSentenceAnnotation,
    removeSentenceAnnotation,
    mergeBookProgress,
    mergeBooksFromRemote,
    updateBooksSyncHashes,
    replaceAllFromRemote,
    flushBooksToStorage,
    ensureBookContentLoaded,
    resolveBookContent,
  };

}
