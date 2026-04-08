"use client";

import { useState, useCallback, useEffect } from "react";

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

const STORAGE_KEY = "english-reader-books";
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

  // Load books from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Book[];
          // Ensure sample book exists
          const hasSample = parsed.some((b) => b.id === SAMPLE_BOOK.id);
          if (hasSample) {
            setBooks(parsed);
          } else {
            setBooks([SAMPLE_BOOK, ...parsed]);
          }
        } catch {
          setBooks([SAMPLE_BOOK]);
        }
      } else {
        setBooks([SAMPLE_BOOK]);
      }
      setIsLoaded(true);
    }
  }, []);

  // Save books to localStorage
  // Only save when books change, debounced to avoid excessive writes
  // Note: processedContent is not saved to localStorage due to size constraints
  useEffect(() => {
    if (!isLoaded || typeof window === "undefined") return;
    
    const timeoutId = setTimeout(() => {
      try {
        // Create a copy without processedContent to save storage space
        const booksToSave = books.map((book) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { processedContent: _pc, ...rest } = book;
          return rest;
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(booksToSave));
      } catch (error) {
        console.warn("Failed to save books to localStorage:", error);
      }
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [books, isLoaded]);

  // Get current book
  const currentBook = books.find((b) => b.id === currentBookId) || null;

  // Calculate reading progress based on page number
  // Returns percentage (0-100), or -1 if unread
  const getProgress = useCallback((book: Book): number => {
    // If book has page-based progress info, use it
    if (book.lastReadPage !== undefined && book.lastReadPage > 0) {
      // Use stored progress if available, otherwise calculate from page
      if (book.annotations && Object.keys(book.annotations).length > 0) {
        // This is a simplified calculation - we'll update it when totalPages is tracked
        const paragraphs = book.content.split(/\n\n+/).filter(p => p.trim().length > 0);
        const totalPages = Math.max(1, Math.ceil(paragraphs.length / 30));
        const progress = Math.min(Math.round((book.lastReadPage / totalPages) * 100), 100);
        return progress;
      }
    }
    // If no page info but has annotations, calculate based on annotated words
    if (book.annotations && Object.keys(book.annotations).length > 0) {
      const totalWords = book.content.split(/\s+/).filter(Boolean).length;
      if (totalWords === 0) return 0;
      const annotatedCount = Object.keys(book.annotations).reduce(
        (sum, key) => sum + (book.annotations[key]?.count || 1),
        0
      );
      return Math.min(Math.round((annotatedCount / totalWords) * 100), 100);
    }
    // Unread
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
  const updateScrollPosition = useCallback((id: string, position: number) => {
    setBooks((prev) =>
      prev.map((b) =>
        b.id === id
          ? { ...b, lastScrollPosition: position }
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

  // Save processed content for faster loading
  const saveProcessedContent = useCallback((id: string, processedContent: ProcessedContent) => {
    // Only save processed content if it's not too large (to avoid quota issues)
    const contentSize = JSON.stringify(processedContent).length;
    if (contentSize > 2 * 1024 * 1024) { // 2MB limit
      console.warn("Processed content too large, skipping save");
      return;
    }
    setBooks((prev) =>
      prev.map((b) =>
        b.id === id
          ? { ...b, processedContent }
          : b
      )
    );
  }, []);

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
    saveProcessedContent,
    openBook,
    closeBook,
    reorderBooks,
    addBookmark,
    removeBookmark,
  };
}
