"use client";

import React, { useState } from "react";
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

  const handleAddBook = (title: string, content: string, tableOfContents?: TocEntry[]) => {
    const newBook = onAddBook(title, content, tableOfContents);
    onOpenBook(newBook.id);
    onAddSuccess?.();
  };

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

      <div className="book-grid">
        {/* Add New Book Card - always first */}
        <BookCard
          isAddCard
          book={{} as Book}
          progress={0}
          lastRead=""
          onOpen={() => setShowAddModal(true)}
          onDelete={() => {}}
        />

        {/* User books sorted by last opened (most recent first) */}
        {[...books]
          .filter((b) => !b.isSample)
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

        {/* Sample book at the end */}
        {books
          .filter((b) => b.isSample)
          .map((book) => (
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

      <AddBookModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddBook}
      />
    </div>
  );
}
