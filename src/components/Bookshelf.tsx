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
}

export function Bookshelf({
  books,
  getProgress,
  formatLastRead,
  onAddBook,
  onDeleteBook,
  onOpenBook,
}: BookshelfProps) {
  const [showAddModal, setShowAddModal] = useState(false);

  const handleAddBook = (title: string, content: string, tableOfContents?: TocEntry[]) => {
    const newBook = onAddBook(title, content, tableOfContents);
    onOpenBook(newBook.id);
  };

  return (
    <div className="bookshelf">
      <div className="bookshelf-header">
        <h1 className="bookshelf-title">我的书架</h1>
        <span className="book-count">{books.filter((b) => !b.isSample).length} 本书</span>
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
