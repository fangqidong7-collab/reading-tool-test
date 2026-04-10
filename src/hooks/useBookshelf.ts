"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { idbGet, idbSet, idbRemove, idbGetAll, idbGetMulti, BOOK_INDEX_KEY, BOOK_DATA_PREFIX } from "@/lib/storage";

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
  lastReadPage?: number; // Track current page for progress calculation
  processedContent?: ProcessedContent;
  tableOfContents?: TocEntry[]; // Extracted TOC from EPUB
  bookmarks?: BookmarkEntry[]; // User bookmarks
}

// Book data for storage (without processedContent)
type StoredBookData = Omit<Book, "processedContent">;

const STORAGE_KEY = "english-reader-books"; // Legacy key for migration
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

// Debounce helper
function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return ((...args: unknown[]) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  }) as T;
}

export function useBookshelf() {
  const [books, setBooks] = useState<Book[]>([]);
  const [currentBookId, setCurrentBookId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [globalVocabulary, setGlobalVocabulary] = useState<
    Record<string, { root: string; meaning: string; pos: string }>
  >({});

  // Track if we've migrated from legacy storage
  const hasMigratedRef = useRef(false);

  // Refs for debounced saves
  const scrollSaveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingScrollSavesRef = useRef<Record<string, number>>({});

  // Save a single book to IndexedDB (without processedContent)
  const saveBook = useCallback(async (book: Book) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { processedContent: _pc, ...bookData } = book;
      await idbSet(`${BOOK_DATA_PREFIX}${book.id}`, JSON.stringify(bookData));
    } catch (error) {
      console.warn("Failed to save book:", book.id, error);
    }
  }, []);

  // Save book index to IndexedDB
  const saveBookIndex = useCallback(async (bookIds: string[]) => {
    try {
      await idbSet(BOOK_INDEX_KEY, JSON.stringify(bookIds));
    } catch (error) {
      console.warn("Failed to save book index:", error);
    }
  }, []);

  // Migrate from legacy storage to new per-book storage
  const migrateFromLegacy = useCallback(async (): Promise<Book[]> => {
    try {
      const saved = await idbGet(STORAGE_KEY);
      if (!saved) return [SAMPLE_BOOK];

      const parsed = JSON.parse(saved) as Book[];
      const migratedBooks: Book[] = [];

      for (const book of parsed) {
        const bookData: StoredBookData = {
          id: book.id,
          title: book.title,
          content: book.content || (book.isSample ? SAMPLE_BOOK.content : ""),
          annotations: book.annotations || {},
          createdAt: book.createdAt,
          lastReadAt: book.lastReadAt,
          isSample: book.isSample,
          lastScrollPosition: book.lastScrollPosition,
          lastReadPage: book.lastReadPage,
          tableOfContents: book.tableOfContents || [],
          bookmarks: book.bookmarks || [],
        };

        // Save each book individually
        await idbSet(`${BOOK_DATA_PREFIX}${book.id}`, JSON.stringify(bookData));
        migratedBooks.push({ ...bookData, processedContent: undefined });
      }

      // Save the book index
      const bookIds = migratedBooks.map((b) => b.id);
      await idbSet(BOOK_INDEX_KEY, JSON.stringify(bookIds));

      // Delete legacy key
      await idbRemove(STORAGE_KEY);

      console.log("Migration complete:", migratedBooks.length, "books migrated");
      return migratedBooks;
    } catch (error) {
      console.error("Migration failed:", error);
      return [SAMPLE_BOOK];
    }
  }, []);

  // Load books from IndexedDB (new per-book storage)
  const loadBooks = useCallback(async (): Promise<Book[]> => {
    try {
      // Check for legacy storage first
      const legacyData = await idbGet(STORAGE_KEY);
      if (legacyData && !hasMigratedRef.current) {
        hasMigratedRef.current = true;
        return migrateFromLegacy();
      }

      // Load book index
      const indexStr = await idbGet(BOOK_INDEX_KEY);
      if (!indexStr) {
        // No books yet, return sample
        return [SAMPLE_BOOK];
      }

      const bookIds: string[] = JSON.parse(indexStr);
      if (bookIds.length === 0) {
        return [SAMPLE_BOOK];
      }

      // Load each book
      const bookKeys = bookIds.map((id) => `${BOOK_DATA_PREFIX}${id}`);
      const bookDataMap = await idbGetMulti(bookKeys);

      const loadedBooks: Book[] = [];
      for (const id of bookIds) {
        const dataStr = bookDataMap[`${BOOK_DATA_PREFIX}${id}`];
        if (dataStr) {
          try {
            const bookData = JSON.parse(dataStr) as StoredBookData;
            // Fill in default content for sample book if missing
            if (bookData.isSample && !bookData.content) {
              bookData.content = SAMPLE_BOOK.content;
            }
            loadedBooks.push({ ...bookData, processedContent: undefined });
          } catch (e) {
            console.warn("Failed to parse book:", id, e);
          }
        }
      }

      if (loadedBooks.length === 0) {
        return [SAMPLE_BOOK];
      }

      // Ensure sample book exists
      const hasSample = loadedBooks.some((b) => b.id === SAMPLE_BOOK.id);
      if (!hasSample) {
        loadedBooks.push(SAMPLE_BOOK);
      }

      return loadedBooks;
    } catch (error) {
      console.error("Failed to load books:", error);
      return [SAMPLE_BOOK];
    }
  }, [migrateFromLegacy]);

  // Load books from IndexedDB (异步加载)
  useEffect(() => {
    if (typeof window === "undefined") return;

    (async () => {
      try {
        const loadedBooks = await loadBooks();
        setBooks(loadedBooks);

        // Ensure sample book is in the index
        const sampleBookIds = loadedBooks.map((b) => b.id);
        if (!sampleBookIds.includes(SAMPLE_BOOK.id)) {
          await saveBook(SAMPLE_BOOK);
          await saveBookIndex([...sampleBookIds, SAMPLE_BOOK.id]);
        } else if (loadedBooks[0]?.id !== SAMPLE_BOOK.id) {
          // Sample book exists but not first, ensure it's indexed
          await saveBookIndex(sampleBookIds);
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
  }, [loadBooks, saveBook, saveBookIndex]);

  // Debounced save for scroll position (at least 1 second)
  const debouncedSaveScroll = useCallback(
    debounce((bookId: string, position: number) => {
      saveBook({
        ...books.find((b) => b.id === bookId)!,
        lastScrollPosition: position,
      });
    }, 1000),
    [books, saveBook]
  );

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
    async (title: string, content: string, tableOfContents?: TocEntry[]): Promise<Book> => {
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

      // Save to state
      setBooks((prev) => {
        const newBooks = [newBook, ...prev];
        // Update index
        saveBookIndex(newBooks.map((b) => b.id));
        return newBooks;
      });

      // Save individual book
      await saveBook(newBook);

      return newBook;
    },
    [saveBook, saveBookIndex]
  );

  // Delete a book (cannot delete sample books)
  const deleteBook = useCallback(
    async (id: string) => {
      const book = books.find((b) => b.id === id);
      if (book?.isSample) return; // Cannot delete sample books

      // Remove from state
      setBooks((prev) => {
        const newBooks = prev.filter((b) => b.id !== id);
        // Update index
        saveBookIndex(newBooks.map((b) => b.id));
        return newBooks;
      });

      // Remove from storage
      await idbRemove(`${BOOK_DATA_PREFIX}${id}`);

      // If current book is deleted, go back to bookshelf
      if (currentBookId === id) {
        setCurrentBookId(null);
      }
    },
    [books, currentBookId, saveBookIndex]
  );

  // Update book annotations - save only this book
  const updateBookAnnotations = useCallback(
    (id: string, annotations: Record<string, { root: string; meaning: string; pos: string; count: number }>) => {
      setBooks((prev) =>
        prev.map((b) =>
          b.id === id
            ? { ...b, annotations, lastReadAt: Date.now() }
            : b
        )
      );
      // Save only this book
      const book = books.find((b) => b.id === id);
      if (book) {
        saveBook({ ...book, annotations, lastReadAt: Date.now() });
      }
    },
    [books, saveBook]
  );

  // Update book content - save only this book
  const updateBookContent = useCallback(
    (id: string, content: string) => {
      setBooks((prev) =>
        prev.map((b) =>
          b.id === id
            ? { ...b, content, lastReadAt: Date.now() }
            : b
        )
      );
      // Save only this book
      const book = books.find((b) => b.id === id);
      if (book) {
        saveBook({ ...book, content, lastReadAt: Date.now() });
      }
    },
    [books, saveBook]
  );

  // Update book scroll position - debounced save (1 second)
  const updateScrollPosition = useCallback(
    (id: string, position: number) => {
      setBooks((prev) =>
        prev.map((b) =>
          b.id === id
            ? { ...b, lastScrollPosition: position }
            : b
        )
      );

      // Debounced save
      pendingScrollSavesRef.current[id] = position;
      
      // Clear existing timer for this book
      if (scrollSaveTimersRef.current[id]) {
        clearTimeout(scrollSaveTimersRef.current[id]);
      }

      scrollSaveTimersRef.current[id] = setTimeout(() => {
        const pos = pendingScrollSavesRef.current[id];
        if (pos !== undefined) {
          const book = books.find((b) => b.id === id);
          if (book) {
            saveBook({ ...book, lastScrollPosition: pos });
          }
          delete pendingScrollSavesRef.current[id];
        }
        delete scrollSaveTimersRef.current[id];
      }, 1000);
    },
    [books, saveBook]
  );

  // Update book read page - save only this book
  const updateReadPage = useCallback(
    (id: string, page: number) => {
      setBooks((prev) =>
        prev.map((b) =>
          b.id === id
            ? { ...b, lastReadPage: page, lastReadAt: Date.now() }
            : b
        )
      );
      // Save only this book
      const book = books.find((b) => b.id === id);
      if (book) {
        saveBook({ ...book, lastReadPage: page, lastReadAt: Date.now() });
      }
    },
    [books, saveBook]
  );

  // Add a bookmark - save only this book
  const addBookmark = useCallback(
    (id: string, page: number, previewText: string) => {
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
          const updatedBook = { ...b, bookmarks: [...bookmarks, newBookmark] };
          // Save only this book
          saveBook(updatedBook);
          return updatedBook;
        })
      );
    },
    [saveBook]
  );

  // Remove a bookmark - save only this book
  const removeBookmark = useCallback(
    (id: string, bookmarkId: string) => {
      setBooks((prev) =>
        prev.map((b) => {
          if (b.id !== id) return b;
          const bookmarks = (b.bookmarks || []).filter((bm) => bm.id !== bookmarkId);
          const updatedBook = { ...b, bookmarks };
          // Save only this book
          saveBook(updatedBook);
          return updatedBook;
        })
      );
    },
    [saveBook]
  );

  // 添加词到全局词汇表
  const addToGlobalVocabulary = useCallback(
    (root: string, meaning: string, pos: string) => {
      setGlobalVocabulary((prev) => ({
        ...prev,
        [root]: { root, meaning, pos },
      }));
    },
    []
  );

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

  // Open a book for reading - save only this book
  const openBook = useCallback(
    (id: string) => {
      setBooks((prev) =>
        prev.map((b) =>
          b.id === id
            ? { ...b, lastReadAt: Date.now() }
            : b
        )
      );
      // Save only this book
      const book = books.find((b) => b.id === id);
      if (book) {
        saveBook({ ...book, lastReadAt: Date.now() });
      }
      setCurrentBookId(id);
    },
    [books, saveBook]
  );

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

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(scrollSaveTimersRef.current).forEach(clearTimeout);
    };
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
  };
}
