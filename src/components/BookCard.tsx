"use client";

import React from "react";
import type { Book } from "@/hooks/useBookshelf";

function getCoverColor(title: string): string {
  const colors = [
    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",  // 靛紫
    "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",  // 粉红
    "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",  // 天蓝
    "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",  // 薄荷绿
    "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",  // 橙粉
    "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",  // 薰衣草
    "linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)",  // 蜜桃紫
    "linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)",  // 淡紫蓝
    "linear-gradient(135deg, #f5576c 0%, #ff6a88 100%)",  // 珊瑚红
    "linear-gradient(135deg, #0ba360 0%, #3cba92 100%)",  // 翡翠绿
    "linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)",  // 深紫蓝
    "linear-gradient(135deg, #fc5c7d 0%, #6a82fb 100%)",  // 玫瑰蓝
    "linear-gradient(135deg, #f78ca0 0%, #f9748f 50%, #fd868c 100%)",  // 暖粉
    "linear-gradient(135deg, #c471f5 0%, #fa71cd 100%)",  // 紫红
    "linear-gradient(135deg, #48c6ef 0%, #6f86d6 100%)",  // 冰蓝
    "linear-gradient(135deg, #feada6 0%, #f5efef 100%)",  // 奶茶
  ];

  // 用整个标题做简单 hash，分布更均匀
  let hash = 0;
  const str = title.trim();
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

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
