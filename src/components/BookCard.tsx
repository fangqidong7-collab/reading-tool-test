"use client";

import React from "react";
import type { Book } from "@/hooks/useBookshelf";

function getCoverColor(title: string): string {
  const colors = [
    "linear-gradient(135deg, #9BC6ED 0%, #86B5DC 100%)",  // Jordy蓝 浅
    "linear-gradient(135deg, #4E90F5 0%, #3A7DE0 100%)",  // Chefchaouen蓝
    "linear-gradient(135deg, #94C000 0%, #7EA800 100%)",  // 苹果绿
    "linear-gradient(135deg, #4B6B03 0%, #3D5902 100%)",  // 苔藓绿
    "linear-gradient(135deg, #6FA8DC 0%, #5B93C7 100%)",  // 天空蓝
    "linear-gradient(135deg, #7CB342 0%, #689F38 100%)",  // 草地绿
    "linear-gradient(135deg, #5C9BE6 0%, #4888D3 100%)",  // 矢车菊蓝
    "linear-gradient(135deg, #8DB600 0%, #769A00 100%)",  // 黄绿
    "linear-gradient(135deg, #4A7FC4 0%, #3B6DAF 100%)",  // 钴蓝
    "linear-gradient(135deg, #66A355 0%, #558B45 100%)",  // 森林绿
    "linear-gradient(135deg, #87BFEA 0%, #72ABD8 100%)",  // 粉蓝
    "linear-gradient(135deg, #5E8C31 0%, #4D7528 100%)",  // 橄榄绿
  ];

  const firstChar = title.trim().charAt(0).toUpperCase();
  const code = firstChar.charCodeAt(0) || 0;
  return colors[code % colors.length];
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

  const coverBg = getCoverColor(book.title);

  return (
    <div className="book-card" onClick={onOpen}>
      <div className="book-cover" style={{ background: coverBg }}>
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
            {progress >= 0 ? (
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            ) : (
              <div className="progress-fill unread" style={{ width: '2%' }} />
            )}
          </div>
          <div className="progress-text">
            {progress >= 0 ? (
              <>
                <span className="progress-value">{progress}%</span>
                <span className="progress-label">已读</span>
              </>
            ) : (
              <span className="progress-value unread-text">未读</span>
            )}
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
