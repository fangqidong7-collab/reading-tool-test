"use client";

import React from "react";
import type { Book } from "@/hooks/useBookshelf";

interface BookCardProps {
  book: Book;
  progress: number;
  lastRead: string;
  onOpen: () => void;
  onDelete: () => void;
  isAddCard?: boolean;
}

export function BookCard({
  book,
  progress,
  lastRead,
  onOpen,
  onDelete,
  isAddCard,
}: BookCardProps) {
  if (isAddCard) {
    return (
      <button className="book-card add-card" onClick={onOpen}>
        <div className="add-icon">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
        <span className="add-text">添加新书</span>
      </button>
    );
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`确定要删除《${book.title}》吗？`)) {
      onDelete();
    }
  };

  return (
    <div className="book-card" onClick={onOpen}>
      <div className="book-cover">
        <div className="book-icon">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        </div>
      </div>
      <div className="book-info">
        <h3 className="book-title" title={book.title}>
          {book.title}
        </h3>
        <div className="book-meta">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="progress-text">
            <span className="progress-value">{progress}%</span>
            <span className="progress-label">已标注</span>
          </div>
        </div>
        <div className="book-time">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>{lastRead}</span>
        </div>
      </div>
      {!book.isSample && (
        <button
          className="delete-btn"
          onClick={handleDelete}
          title="删除书籍"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      )}
    </div>
  );
}
