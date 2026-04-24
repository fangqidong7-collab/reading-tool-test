"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { BookCard } from "./BookCard";
import { AddBookModal } from "./AddBookModal";
import type { Book } from "@/hooks/useBookshelf";
import type { TocEntry } from "@/lib/fileParser";
import { BOOKSHELF_THEMES, type BookshelfTheme } from "@/hooks/useBookshelfTheme";

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
  bookshelfTheme: BookshelfTheme;
  bookshelfThemeId: string;
  setBookshelfThemeId: (id: string) => void;
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
  bookshelfTheme,
  bookshelfThemeId,
  setBookshelfThemeId,
}: BookshelfProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showThemePicker, setShowThemePicker] = useState(false);
  const themePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showThemePicker) return;
    const handleClick = (e: MouseEvent) => {
      if (themePickerRef.current && !themePickerRef.current.contains(e.target as Node)) {
        setShowThemePicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showThemePicker]);

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

  const t = bookshelfTheme;

  return (
    <div className="bookshelf">
      <div className="bookshelf-header">
        <div className="header-left-area">
          <h1 className="bookshelf-title" style={{ color: t.textColor }}>我的书架</h1>
          <div className="theme-picker-wrapper" ref={themePickerRef}>
            <button
              className="theme-toggle-btn"
              onClick={() => setShowThemePicker((v) => !v)}
              title="切换主题"
              style={{ color: t.isDark ? "rgba(255,255,255,0.6)" : t.accent }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="13.5" cy="6.5" r="2.5" />
                <circle cx="17.5" cy="10.5" r="1.5" />
                <circle cx="8.5" cy="7.5" r="1.5" />
                <circle cx="6.5" cy="12" r="1.5" />
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.5-.7 1.5-1.5 0-.4-.1-.7-.4-1-.3-.3-.4-.6-.4-1 0-.8.7-1.5 1.5-1.5H16c3.3 0 6-2.7 6-6 0-5.5-4.5-9-10-9z" />
              </svg>
            </button>
            {showThemePicker && (
              <div className="theme-dropdown" style={{
                background: t.isDark ? "#1e2a42" : "#fff",
                boxShadow: t.isDark ? "0 4px 20px rgba(0,0,0,0.5)" : "0 4px 20px rgba(0,0,0,0.12)",
                border: t.isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.06)",
              }}>
                {BOOKSHELF_THEMES.map((th) => (
                  <button
                    key={th.id}
                    className={`theme-option${bookshelfThemeId === th.id ? " active" : ""}`}
                    onClick={() => { setBookshelfThemeId(th.id); setShowThemePicker(false); }}
                    style={{
                      color: t.isDark ? "#ddd" : "#444",
                      background: bookshelfThemeId === th.id
                        ? (t.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)")
                        : "transparent",
                    }}
                  >
                    <span
                      className="theme-option-dot"
                      style={{
                        background: th.pageBg,
                        boxShadow: th.isDark ? "inset 0 0 0 1px rgba(255,255,255,0.25)" : "inset 0 0 0 1px rgba(0,0,0,0.1)",
                        border: bookshelfThemeId === th.id ? `2px solid ${th.accent}` : "2px solid transparent",
                      }}
                    />
                    <span className="theme-option-name">{th.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {lastSyncAt && (
            <span className="sync-time-label" style={{ color: t.isDark ? "rgba(255,255,255,0.5)" : undefined }}>
              {formatSyncTime(lastSyncAt)}
            </span>
          )}
          <button
            className="cloud-sync-btn"
            onClick={onSyncClick}
            title="同步"
            style={{ background: t.accent, boxShadow: `0 2px 8px ${t.accent}50` }}
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
        <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.isDark ? "rgba(255,255,255,0.4)" : "#aaa"} strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          className="search-input"
          placeholder="搜索书名..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            background: t.searchBg,
            borderColor: t.searchBorder,
            color: t.textColor,
          }}
        />
        {searchQuery && (
          <button className="search-clear" onClick={() => setSearchQuery("")} style={{ color: t.isDark ? "rgba(255,255,255,0.5)" : undefined }}>
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
              coverPalette={t.coverPalette}
              isDarkTheme={!!t.isDark}
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
            coverPalette={t.coverPalette}
            isDarkTheme={!!t.isDark}
          />
        ))}
      </div>

      <button
        className="fab-add-book"
        onClick={() => setShowAddModal(true)}
        title="添加新书"
        style={{ background: t.accent, boxShadow: `0 3px 10px ${t.accent}50` }}
      >
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
