"use client";

import { useState, useCallback, useEffect } from "react";
import { idbGet, idbSet } from "@/lib/storage";

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

export interface Book {
  id: string;
  title: string;
  content: string;
  annotations: Record<string, { root: string; meaning: string; pos: string; count: number }>;
  createdAt: number;
  lastReadAt: number;
  isSample: boolean;
  lastScrollPosition?: number;
    lastParagraphIndex?: number; 
  lastReadPage?: number; // Track current page for progress calculation
  processedContent?: ProcessedContent;
  tableOfContents?: TocEntry[]; // Extracted TOC from EPUB
  bookmarks?: BookmarkEntry[]; // User bookmarks
}

const STORAGE_KEY = "english-reader-books";
const GLOBAL_VOCAB_KEY = "english-reader-global-vocabulary";
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

export function useBookshelf() {
  const [books, setBooks] = useState<Book[]>([]);
  const [currentBookId, setCurrentBookId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
const [globalVocabulary, setGlobalVocabulary] = useState<
  Record<string, { root: string; meaning: string; pos: string; correctCount: number }>
>({});

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
            const booksWithContent = parsed.map((b) => ({
              ...b,
              // 如果 content 为空，用 SAMPLE_BOOK 的内容填充（如果是示例书）
              content: b.content || (b.isSample ? SAMPLE_BOOK.content : ""),
              annotations: b.annotations || {},
              bookmarks: b.bookmarks || [],
            }));
            const hasSample = booksWithContent.some((b) => b.id === SAMPLE_BOOK.id);
            if (hasSample) {
              setBooks(booksWithContent);
            } else {
              setBooks([SAMPLE_BOOK, ...booksWithContent]);
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
          setGlobalVocabulary(parsed);
        }
      } catch {
        console.warn("加载全局词汇表失败");
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
          const booksToSave = books.map((book) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { processedContent: _pc, ...rest } = book;
            return rest;
          });
          await idbSet(STORAGE_KEY, JSON.stringify(booksToSave));
        } catch (error) {
          console.warn("IndexedDB 保存失败:", error);
          // fallback: 尝试不含 content 的精简版
          try {
            const metadata = books.map((book) => {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { content: _c, processedContent: _pc, ...meta } = book;
              return meta;
            });
            await idbSet(STORAGE_KEY, JSON.stringify(metadata));
            console.warn("仅保存了元数据（无content）");
          } catch (e2) {
            console.error("连元数据都存不下:", e2);
          }
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
      const newBook: Book = {
        id: `book-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: title.trim() || "未命名书籍",
        content: content.trim(),
        annotations: {},
        createdAt: Date.now(),
        lastReadAt: Date.now(),
        isSample: false,
        bookmarks: [],
        tableOfContents: tableOfContents || [],
      };
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
    // If current book is deleted, go back to bookshelf
    if (currentBookId === id) {
      setCurrentBookId(null);
    }
  }, [currentBookId]);

  // Update book annotations
  const updateBookAnnotations = useCallback(
    (id: string, annotations: Record<string, { root: string; meaning: string; pos: string; count: number }>) => {
      setBooks((prev) =>
        prev.map((b) =>
          b.id === id
            ? { ...b, annotations, lastReadAt: Date.now() }
            : b
        )
      );
    },
    []
  );

  // Update book content
  const updateBookContent = useCallback((id: string, content: string) => {
    setBooks((prev) =>
      prev.map((b) =>
        b.id === id
          ? { ...b, content, lastReadAt: Date.now() }
          : b
      )
    );
  }, []);

  // Update book scroll position
  const updateScrollPosition = useCallback((id: string, position: number, paragraphIndex?: number) => {
    setBooks((prev) =>
      prev.map((b) =>
        b.id === id
          ? { 
              ...b, 
              lastScrollPosition: position,
              ...(paragraphIndex !== undefined && paragraphIndex >= 0 ? { lastParagraphIndex: paragraphIndex } : {}),
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

    // 添加词到全局词汇表
  const addToGlobalVocabulary = useCallback(
    (root: string, meaning: string, pos: string) => {
      setGlobalVocabulary((prev) => ({
        ...prev,
        [root]: { root, meaning, pos, correctCount: prev[root]?.correctCount || 0 },
      }));
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
    setGlobalVocabulary((prev) => {
      const next: typeof prev = {};
      for (const [key, value] of Object.entries(prev)) {
        if ((value.correctCount || 0) < threshold) {
          next[key] = value;
        }
      }
      return next;
    });
  }, []);

  // 从全局词汇表删除词
  const removeFromGlobalVocabulary = useCallback((root: string) => {
    setGlobalVocabulary((prev) => {
      const next = { ...prev };
      delete next[root];
      return next;
    });
  }, []);

  // 清空全局词汇表
  const clearGlobalVocabulary = useCallback(() => {
    setGlobalVocabulary({});
  }, []);

  // 合并导入的词汇到全局词汇表（重复替换，不重复追加，不覆盖原有）
  const mergeGlobalVocabulary = useCallback(
    (incoming: Record<string, { root: string; meaning: string; pos: string }>) => {
      setGlobalVocabulary((prev) => {
        const merged = { ...prev };
        for (const [key, value] of Object.entries(incoming)) {
          merged[key] = value;
        }
        return merged;
      });
    },
    []
  );


  // Open a book for reading
  const openBook = useCallback((id: string) => {
    setBooks((prev) =>
      prev.map((b) =>
        b.id === id
          ? { ...b, lastReadAt: Date.now() }
          : b
      )
    );
    setCurrentBookId(id);
  }, []);

  // Close the current book and return to bookshelf
  const closeBook = useCallback(() => {
    setCurrentBookId(null);
  }, []);

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

  return {
    books,
    currentBook,
    currentBookId,
    isLoaded,
    getProgress,
    formatLastRead,
    addBook,
    deleteBook,
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
    addToGlobalVocabulary,
    removeFromGlobalVocabulary,
    clearGlobalVocabulary,
    mergeGlobalVocabulary,
    incrementCorrectCount,
    clearMasteredWords,
  };

}
