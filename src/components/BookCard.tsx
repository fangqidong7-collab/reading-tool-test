"use client";

import React from "react";
import type { Book } from "@/hooks/useBookshelf";

function getCoverColors(title: string): { bg: string; spine: string } {
  const palettes = [
    { bg: "#8EA8B8", spine: "#7A95A5" },
    { bg: "#9AAE8E", spine: "#889C7D" },
    { bg: "#A898AB", spine: "#958698" },
    { bg: "#B0A494", spine: "#9D9183" },
    { bg: "#8898A8", spine: "#76879A" },
    { bg: "#93AE9A", spine: "#819C88" },
    { bg: "#8BA59E", spine: "#7A9490" },
    { bg: "#7E8F9C", spine: "#6E7F8C" },
    { bg: "#A89890", spine: "#968680" },
    { bg: "#9CABA0", spine: "#8A9A8F" },
    { bg: "#A5A0B0", spine: "#938EA0" },
    { bg: "#B0A898", spine: "#9E9688" },
  ];

  const firstChar = title.trim().charAt(0).toUpperCase();
  const code = firstChar.charCodeAt(0) || 0;
  return palettes[code % palettes.length];
}

interface BookCardProps {
  book: Book;
  progress: number;
  lastRead: string;
  onOpen: () => void;
  onDelete: () => void;
  onRename?: (newTitle: string) => void;
  isAddCard?: boolean;
}

export function BookCard({
  book,
  progress,
  lastRead,
  onOpen,
  onDelete,
  onRename,
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

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newTitle = window.prompt("请输入新书名", book.title);
    if (newTitle !== null && newTitle.trim() && newTitle.trim() !== book.title) {
      onRename?.(newTitle.trim());
    }
  };

  const { bg, spine } = getCoverColors(book.title);

  return (
    <div className="book-card" onClick={onOpen}>
      <div className="book-cover-3d">
        <div className="book-spine" style={{ background: spine }} />
        <div className="book-front" style={{ background: bg }}>
          <span className="book-cover-title">{book.title}</span>
          <div className="book-cover-progress">
            {progress >= 0 ? `${progress}%` : ""}
          </div>
        </div>
      </div>
      <div className="book-time">
        <span>{lastRead}</span>
      </div>
      {!book.isSample && (
        <div className="card-actions">
          <button
            className="rename-btn"
            onClick={handleRename}
            title="修改书名"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            className="delete-btn"
            onClick={handleDelete}
            title="删除书籍"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
