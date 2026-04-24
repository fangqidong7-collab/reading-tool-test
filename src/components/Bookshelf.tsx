"use client";

import React, { useState, useMemo } from "react";
import { BookCard } from "./BookCard";
import { AddBookModal } from "./AddBookModal";
import type { Book } from "@/hooks/useBookshelf";
import type { TocEntry } from "@/lib/fileParser";

interface BookshelfProps {
  books: Book[];
  getProgress: (book: Book) => number;
  formatLastRead: (timestamp: number) => string;
  onAddBook: (title: string, content: string, tableOfContents?: TocEntry[]) => Book;
  onDeleteBook: (id: string) => void;
  onRenameBook: (id: string, newTitle: string) => void;
  onOpenBook: (id: string) => void;
  onSyncClick: () => void;
  onAddSuccess?: () => void;
  lastSyncAt?: number | null;
}

function formatSyncTime(ts: number): string {
  const now = Date.now();
  const diffMin = Math.floor((now - ts) / 60000);
  if (diffMin < 1) return "刚刚同步";
  if (diffMin < 60) return `${diffMin}分钟前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}小时前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export function Bookshelf({
  books,
  getProgress,
  formatLastRead,
  onAddBook,
  onDeleteBook,
  onRenameBook,
  onOpenBook,
  onSyncClick,
  onAddSuccess,
  lastSyncAt,
}: BookshelfProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleAddBook = (title: string, content: string, tableOfContents?: TocEntry[]) => {
    const newBook = onAddBook(title, content, tableOfContents);
    onOpenBook(newBook.id);
    onAddSuccess?.();
  };

  const userBooks = useMemo(() => {
    const filtered = books.filter((b) => !b.isSample);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return filtered.filter((b) => b.title.toLowerCase().includes(q));
    }
    return filtered;
  }, [books, searchQuery]);

  const sampleBooks = useMemo(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return books.filter((b) => b.isSample && b.title.toLowerCase().includes(q));
    }
    return books.filter((b) => b.isSample);
  }, [books, searchQuery]);

  return (
    <div className="bookshelf">
      <div className="bookshelf-header">
        <div className="header-left-area">
          <h1 className="bookshelf-title">我的书架</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {lastSyncAt && (
            <span className="sync-time-label">
              {formatSyncTime(lastSyncAt)}
            </span>
          )}
          <button
            className="cloud-sync-btn"
            onClick={onSyncClick}
            title="同步"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9V3m0 18v-6m0-6a9 9 0 0 0 9-9" />
            </svg>
            <span>同步</span>
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="bookshelf-search">
        <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          className="search-input"
          placeholder="搜索书名..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className="search-clear" onClick={() => setSearchQuery("")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      <div className="book-grid">
        {[...userBooks]
          .sort((a, b) => (b.lastReadAt || 0) - (a.lastReadAt || 0))
          .map((book) => (
            <BookCard
              key={book.id}
              book={book}
              progress={getProgress(book)}
              lastRead={formatLastRead(book.lastReadAt)}
              onOpen={() => onOpenBook(book.id)}
              onDelete={() => onDeleteBook(book.id)}
              onRename={(newTitle) => onRenameBook(book.id, newTitle)}
            />
          ))}

        {sampleBooks.map((book) => (
          <BookCard
            key={book.id}
            book={book}
            progress={getProgress(book)}
            lastRead={formatLastRead(book.lastReadAt)}
            onOpen={() => onOpenBook(book.id)}
            onDelete={() => {}}
          />
        ))}
      </div>

      <button className="fab-add-book" onClick={() => setShowAddModal(true)} title="添加新书">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <AddBookModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddBook}
      />
    </div>
  );
}
