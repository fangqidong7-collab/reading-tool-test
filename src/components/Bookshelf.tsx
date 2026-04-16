"use client";

import React, { useState } from "react";
import { BookCard } from "./BookCard";
import { AddBookModal } from "./AddBookModal";
import type { Book } from "@/hooks/useBookshelf";
import type { TocEntry } from "@/lib/fileParser";
import { SHELF_THEMES, getThemeById, type ShelfTheme } from "@/lib/shelfThemes";

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

/** 根据主题色阶计算各 UI 元素的颜色 */
function computeThemeColors(theme: ShelfTheme) {
  const [c0, c1, c2, c3, c4] = theme.colors;
  return {
    pageBg: c0,
    cardBg: `${c0}cc`,
    text: c4,
    subText: `${c4}99`,
    accent: c3,
    progressBg: `${c1}40`,
    progressFill: `linear-gradient(90deg, ${c2}, ${c3})`,
    addBorder: `${c1}88`,
    addHoverBg: `${c1}22`,
    headerText: c4,
    syncBtnBg: `linear-gradient(135deg, ${c2} 0%, ${c3} 100%)`,
    syncBtnShadow: `${c2}50`,
    tabActiveBg: c3,
    tabActiveText: c0,
    badgeBg: c2,
    badgeText: c4,
  };
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
  const tc = computeThemeColors(theme);

  const cardColors = {
    text: tc.text,
    subText: tc.subText,
    accent: tc.accent,
    progressBg: tc.progressBg,
    progressFill: tc.progressFill,
    cardBg: tc.cardBg,
    addBorder: tc.addBorder,
    addHoverBg: tc.addHoverBg,
  };

  const handleAddBook = (title: string, content: string, tableOfContents?: TocEntry[]) => {
    const newBook = onAddBook(title, content, tableOfContents);
    onOpenBook(newBook.id);
  };

  return (
    <div className="bookshelf" style={{ background: tc.pageBg }}>
      <div className="bookshelf-header">
        <div className="header-left-area">
          <h1 className="bookshelf-title" style={{ color: tc.headerText }}>我的书架</h1>
          <button
            className="theme-picker-btn"
            onClick={() => setShowThemePicker(!showThemePicker)}
            title="切换书架主题"
            style={{ color: tc.subText }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a7 7 0 0 0 0 14h7" />
              <circle cx="12" cy="9" r="1.5" fill="currentColor" />
              <circle cx="8.5" cy="12.5" r="1.5" fill="currentColor" />
              <circle cx="15.5" cy="12.5" r="1.5" fill="currentColor" />
            </svg>
          </button>
        </div>
        <button
          className="cloud-sync-btn"
          onClick={onDataManageClick}
          title="数据备份"
          style={{
            background: tc.syncBtnBg,
            boxShadow: `0 2px 8px ${tc.syncBtnShadow}`,
          }}
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
        <div className="theme-picker" style={{ background: tc.cardBg }}>
          <div className="theme-picker-title" style={{ color: tc.text }}>选择书架主题</div>
          <div className="theme-picker-grid">
            {SHELF_THEMES.map((t) => (
              <button
                key={t.id}
                className={`theme-swatch ${shelfThemeId === t.id ? "active" : ""}`}
                onClick={() => {
                  onShelfThemeChange(t.id);
                  setShowThemePicker(false);
                }}
                title={t.name}
              >
                <div className="swatch-colors">
                  {t.colors.map((c, i) => (
                    <div key={i} className="swatch-stripe" style={{ background: c }} />
                  ))}
                </div>
                <span className="swatch-name" style={{ color: t.colors[4] }}>{t.name}</span>
              </button>
            ))}
          </div>
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
          theme={theme}
          themeColors={cardColors}
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
              theme={theme}
              themeColors={cardColors}
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
              theme={theme}
              themeColors={cardColors}
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
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
          opacity: 0.7;
        }
        .theme-picker-btn:hover {
          opacity: 1;
          background: rgba(128, 128, 128, 0.1);
        }
        .theme-picker {
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 24px;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(128, 128, 128, 0.15);
        }
        .theme-picker-title {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 12px;
        }
        .theme-picker-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
          gap: 10px;
        }
        .theme-swatch {
          background: none;
          border: 2px solid transparent;
          border-radius: 10px;
          padding: 6px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }
        .theme-swatch:hover {
          transform: scale(1.05);
        }
        .theme-swatch.active {
          border-color: ${tc.accent};
          box-shadow: 0 0 0 2px ${tc.accent}40;
        }
        .swatch-colors {
          width: 100%;
          height: 36px;
          border-radius: 6px;
          overflow: hidden;
          display: flex;
        }
        .swatch-stripe {
          flex: 1;
        }
        .swatch-name {
          font-size: 11px;
          font-weight: 500;
        }

        @media (max-width: 600px) {
          .theme-picker-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
          }
          .theme-picker {
            padding: 12px;
            margin-bottom: 16px;
          }
        }
      `}</style>
    </div>
  );
}
