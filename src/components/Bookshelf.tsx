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
  onOpenBook: (id: string) => void;
  onDataManageClick: () => void;
}

export function Bookshelf({
  books,
  getProgress,
  formatLastRead,
  onAddBook,
  onDeleteBook,
  onOpenBook,
  onDataManageClick,
}: BookshelfProps) {
  const [showAddModal, setShowAddModal] = useState(false);

  const handleAddBook = (title: string, content: string, tableOfContents?: TocEntry[]) => {
    const newBook = onAddBook(title, content, tableOfContents);
    onOpenBook(newBook.id);
  };

  return (
    <div className="bookshelf">
      <div className="bookshelf-header">
        <div className="header-left-area">
          <h1 className="bookshelf-title">我的书架</h1>
          <span className="book-count">{books.filter((b) => !b.isSample).length} 本书</span>
        </div>
        <button
          className="cloud-sync-btn"
          onClick={onDataManageClick}
          title="数据备份"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>数据备份</span>
        </button>
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

        {/* User books (sorted by last read) */}
        {books
          .filter((b) => !b.isSample)
          .map((book) => (
            <BookCard
              key={book.id}
              book={book}
              progress={getProgress(book)}
              lastRead={formatLastRead(book.lastReadAt)}
              onOpen={() => onOpenBook(book.id)}
              onDelete={() => onDeleteBook(book.id)}
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
