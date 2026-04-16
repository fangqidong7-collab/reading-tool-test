"use client";

import React from "react";
import type { Book } from "@/hooks/useBookshelf";
import type { ShelfTheme } from "@/lib/shelfThemes";
import { getCoverGradient } from "@/lib/shelfThemes";

interface BookCardProps {
  book: Book;
  progress: number;
  lastRead: string;
  onOpen: () => void;
  onDelete: () => void;
  isAddCard?: boolean;
  theme?: ShelfTheme;
  themeColors?: {
    text: string;
    subText: string;
    accent: string;
    progressBg: string;
    progressFill: string;
    cardBg: string;
    addBorder: string;
    addHoverBg: string;
  };
}

export function BookCard({
  book,
  progress,
  lastRead,
  onOpen,
  onDelete,
  isAddCard,
  theme,
  themeColors,
}: BookCardProps) {
  const tc = themeColors;

  if (isAddCard) {
    return (
      <button
        className="book-card add-card"
        onClick={onOpen}
        style={tc ? {
          borderColor: tc.addBorder,
          background: tc.cardBg,
        } : undefined}
      >
        <div className="add-icon" style={tc ? { color: tc.subText } : undefined}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
        <span className="add-text" style={tc ? { color: tc.subText } : undefined}>添加新书</span>
      </button>
    );
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`确定要删除《${book.title}》吗？`)) {
      onDelete();
    }
  };

  const coverBg = theme ? getCoverGradient(book.title, theme) : "linear-gradient(135deg, #4a90d9 0%, #357abd 100%)";

  return (
    <div
      className="book-card"
      onClick={onOpen}
      style={tc ? { background: tc.cardBg } : undefined}
    >
      <div className="book-cover" style={{ background: coverBg }}>
        <div className="book-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        </div>
      </div>
      <div className="book-info">
        <h3
          className="book-title"
          title={book.title}
          style={tc ? { color: tc.text } : undefined}
        >
          {book.title}
        </h3>
        <div className="book-meta">
          <div className="progress-bar" style={tc ? { background: tc.progressBg } : undefined}>
            {progress >= 0 ? (
              <div className="progress-fill" style={{ width: `${progress}%`, background: tc?.progressFill }} />
            ) : (
              <div className="progress-fill unread" style={{ width: "2%" }} />
            )}
          </div>
          <div className="progress-text">
            {progress >= 0 ? (
              <>
                <span className="progress-value" style={tc ? { color: tc.accent } : undefined}>
                  {progress}%
                </span>
                <span className="progress-label" style={tc ? { color: tc.subText } : undefined}>
                  已读
                </span>
              </>
            ) : (
              <span className="progress-value unread-text" style={tc ? { color: tc.subText } : undefined}>
                未读
              </span>
            )}
          </div>
        </div>
        <div className="book-time" style={tc ? { color: tc.subText } : undefined}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>{lastRead}</span>
        </div>
      </div>
      {!book.isSample && (
        <button className="delete-btn" onClick={handleDelete} title="删除书籍">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      )}
    </div>
  );
}
