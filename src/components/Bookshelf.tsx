"use client";

import React, { useState } from "react";
import { BookCard } from "./BookCard";
import { AddBookModal } from "./AddBookModal";
import type { Book } from "@/hooks/useBookshelf";
import type { TocEntry } from "@/lib/fileParser";
import { SHELF_THEMES, getThemeById } from "@/lib/shelfThemes";

interface BookshelfProps {
  books: Book[];
  getProgress: (book: Book) => number;
  formatLastRead: (timestamp: number) => string;
  onAddBook: (title: string, content: string, tableOfContents?: TocEntry[]) => Book;
  onDeleteBook: (id: string) => void;
  onOpenBook: (id: string) => void;
  onDataManageClick: () => void;
  shelfThemeId: string;
  onShelfThemeChange: (id: string) => void;
}

export function Bookshelf({
  books,
  getProgress,
  formatLastRead,
  onAddBook,
  onDeleteBook,
  onOpenBook,
  onDataManageClick,
  shelfThemeId,
  onShelfThemeChange,
}: BookshelfProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);

  const theme = getThemeById(shelfThemeId);

  const handleAddBook = (title: string, content: string, tableOfContents?: TocEntry[]) => {
    const newBook = onAddBook(title, content, tableOfContents);
    onOpenBook(newBook.id);
  };

  return (
    <div className="bookshelf">
      <div className="bookshelf-header">
        <div className="header-left-area">
          <h1 className="bookshelf-title">我的书架</h1>
          <button
            className="theme-picker-btn"
            onClick={() => setShowThemePicker(!showThemePicker)}
            title="封面配色"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="13.5" cy="6.5" r="2.5"/>
              <circle cx="6.5" cy="13.5" r="2.5"/>
              <circle cx="17.5" cy="17.5" r="2.5"/>
              <circle cx="12" cy="12" r="10"/>
            </svg>
          </button>
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

      {showThemePicker && (
        <div className="theme-picker">
          {SHELF_THEMES.map((t) => (
            <button
              key={t.id}
              className={`theme-swatch ${shelfThemeId === t.id ? "active" : ""}`}
              onClick={() => { onShelfThemeChange(t.id); setShowThemePicker(false); }}
              title={t.name}
            >
              <div className="swatch-colors">
                {t.coverColors.map((c, i) => (
                  <div key={i} style={{ background: c, flex: 1 }} />
                ))}
              </div>
              <span className="swatch-label">{t.name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="book-grid">
        <BookCard
          isAddCard
          book={{} as Book}
          progress={0}
          lastRead=""
          onOpen={() => setShowAddModal(true)}
          onDelete={() => {}}
          shelfTheme={theme}
        />
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
              shelfTheme={theme}
            />
          ))}
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
              shelfTheme={theme}
            />
          ))}
      </div>

      <AddBookModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddBook}
      />

      <style jsx>{`
        .theme-picker-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 6px;
          border-radius: 8px;
          color: #888;
          display: flex;
          align-items: center;
          transition: all 0.15s;
        }
        .theme-picker-btn:hover {
          color: #555;
          background: rgba(0,0,0,0.05);
        }
        .theme-picker {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 24px;
          padding: 16px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.08);
        }
        .theme-swatch {
          background: none;
          border: 2px solid transparent;
          border-radius: 10px;
          padding: 6px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          transition: all 0.15s;
        }
        .theme-swatch:hover {
          border-color: #ddd;
        }
        .theme-swatch.active {
          border-color: #4a90d9;
          box-shadow: 0 0 0 2px rgba(74,144,217,0.2);
        }
        .swatch-colors {
          width: 100%;
          height: 28px;
          border-radius: 6px;
          overflow: hidden;
          display: flex;
        }
        .swatch-label {
          font-size: 11px;
          color: #666;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
