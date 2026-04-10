"use client";

import React from "react";
import type { TocEntry, BookmarkEntry } from "@/hooks/useBookshelf";

interface LeftDrawerProps {
  isOpen: boolean;
  activeTab: 'toc' | 'bookmarks';
  isDarkMode: boolean;
  tableOfContents: TocEntry[];
  bookmarks: BookmarkEntry[];
  currentScrollPercent: number;
  isSample: boolean;
  onClose: () => void;
  onTabChange: (tab: 'toc' | 'bookmarks') => void;
  onGoToParagraph: (paragraphIndex: number) => void;
  onGoToPage: (page: number) => void;
  onToggleBookmark: () => void;
  onRemoveBookmark: (bookmarkId: string) => void;
}

export function LeftDrawer({
  isOpen,
  activeTab,
  isDarkMode,
  tableOfContents,
  bookmarks,
  currentScrollPercent,
  isSample,
  onClose,
  onTabChange,
  onGoToParagraph,
  onGoToPage,
  onToggleBookmark,
  onRemoveBookmark,
}: LeftDrawerProps) {
  return (
    <>
      <div className={`left-drawer-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <div className={`left-drawer ${isOpen ? 'open' : ''}`} style={{ backgroundColor: isDarkMode ? "#1e1e2e" : "#ffffff" }}>
        <div className="left-drawer-header" style={{ borderBottomColor: isDarkMode ? "#333" : "#e0e0e0" }}>
          <div className="left-drawer-tabs">
            <button
              className={`drawer-tab ${activeTab === 'toc' ? 'active' : ''}`}
              onClick={() => onTabChange('toc')}
              style={{ 
                color: activeTab === 'toc' ? (isDarkMode ? "#6ba3e0" : "#4a90d9") : (isDarkMode ? "#888" : "#666"),
                borderBottomColor: activeTab === 'toc' ? (isDarkMode ? "#6ba3e0" : "#4a90d9") : "transparent",
              }}
            >
              目录
            </button>
            <button
              className={`drawer-tab ${activeTab === 'bookmarks' ? 'active' : ''}`}
              onClick={() => onTabChange('bookmarks')}
              style={{ 
                color: activeTab === 'bookmarks' ? (isDarkMode ? "#6ba3e0" : "#4a90d9") : (isDarkMode ? "#888" : "#666"),
                borderBottomColor: activeTab === 'bookmarks' ? (isDarkMode ? "#6ba3e0" : "#4a90d9") : "transparent",
              }}
            >
              书签 ({bookmarks.length || 0})
            </button>
          </div>
          <button 
            className="drawer-close" 
            onClick={onClose}
            style={{ color: isDarkMode ? "#888" : "#666" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        
        <div className="left-drawer-content">
          {/* TOC Tab */}
          {activeTab === 'toc' && (
            <div className="toc-list">
              {tableOfContents && tableOfContents.length > 0 ? (
                tableOfContents.map((entry, index) => (
                  <button
                    key={index}
                    className="toc-item"
                    onClick={() => {
                      if (entry.paragraphIndex !== undefined) {
                        onGoToParagraph(entry.paragraphIndex);
                      } else {
                        onGoToPage(entry.page);
                      }
                    }}
                    style={{ color: isDarkMode ? "#ccc" : "#333" }}
                  >
                    {entry.title}
                  </button>
                ))
              ) : (
                <div className="empty-message" style={{ color: isDarkMode ? "#666" : "#999" }}>
                  {isSample ? "示例书籍暂无目录" : "暂无目录信息"}
                </div>
              )}
            </div>
          )}
          
          {/* Bookmarks Tab */}
          {activeTab === 'bookmarks' && (
            <div className="bookmark-list">
              {bookmarks && bookmarks.length > 0 ? (
                <>
                  <button
                    className="add-bookmark-btn"
                    onClick={onToggleBookmark}
                    style={{ 
                      backgroundColor: isDarkMode ? "#3a3a4e" : "#f0f0f0",
                      color: isDarkMode ? "#6ba3e0" : "#4a90d9",
                    }}
                  >
                    {bookmarks.some(bm => bm.page === currentScrollPercent) ? "移除当前位置书签" : "添加当前位置书签"}
                  </button>
                  {bookmarks
                    .sort((a, b) => a.page - b.page)
                    .map((bookmark) => (
                      <div
                        key={bookmark.id}
                        className="bookmark-item"
                        style={{ backgroundColor: isDarkMode ? "#2a2a3e" : "#f8f9fa" }}
                      >
                        <button
                          className="bookmark-page"
                          onClick={() => onGoToPage(bookmark.page)}
                          style={{ color: isDarkMode ? "#ccc" : "#333" }}
                        >
                          {bookmark.previewText || `位置 ${Math.round(bookmark.page)}%`}
                        </button>
                        <button
                          className="bookmark-delete"
                          onClick={() => onRemoveBookmark(bookmark.id)}
                          style={{ color: isDarkMode ? "#888" : "#999" }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    ))
                  }
                </>
              ) : (
                <div className="empty-message" style={{ color: isDarkMode ? "#666" : "#999" }}>
                  <p>暂无书签</p>
                  <button
                    className="add-bookmark-btn"
                    onClick={onToggleBookmark}
                    style={{ 
                      backgroundColor: isDarkMode ? "#3a3a4e" : "#f0f0f0",
                      color: isDarkMode ? "#6ba3e0" : "#4a90d9",
                    }}
                  >
                    添加当前页书签
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .left-drawer-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 900;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s;
        }

        .left-drawer-overlay.open {
          opacity: 1;
          pointer-events: auto;
        }

        .left-drawer {
          position: fixed;
          top: 0;
          left: 0;
          width: 280px;
          height: 100%;
          background: #ffffff;
          box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
          z-index: 950;
          transform: translateX(-100%);
          transition: transform 0.3s;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .left-drawer.open {
          transform: translateX(0);
        }

        .left-drawer-header {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid #e0e0e0;
          gap: 8px;
          flex-shrink: 0;
        }

        .left-drawer-tabs {
          flex: 1;
          display: flex;
          gap: 16px;
        }

        .drawer-tab {
          padding: 8px 4px;
          border: none;
          background: transparent;
          font-size: 14px;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.15s;
        }

        .drawer-close {
          padding: 4px;
          border: none;
          background: transparent;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .left-drawer-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .toc-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .toc-item {
          padding: 10px 12px;
          border: none;
          background: transparent;
          text-align: left;
          font-size: 14px;
          cursor: pointer;
          border-radius: 4px;
          transition: background 0.15s;
          color: #333;
        }

        .toc-item:hover {
          background: #f0f0f0;
        }

        .bookmark-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .add-bookmark-btn {
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.15s;
        }

        .bookmark-item {
          display: flex;
          align-items: center;
          padding: 10px 12px;
          border-radius: 6px;
          gap: 8px;
        }

        .bookmark-page {
          flex: 1;
          border: none;
          background: transparent;
          text-align: left;
          font-size: 13px;
          cursor: pointer;
          color: #333;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .bookmark-delete {
          padding: 4px;
          border: none;
          background: transparent;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.6;
          transition: opacity 0.15s;
        }

        .bookmark-delete:hover {
          opacity: 1;
        }

        .empty-message {
          text-align: center;
          padding: 24px;
          color: #999;
          font-size: 14px;
        }

        .empty-message p {
          margin-bottom: 16px;
        }

        @media (min-width: 769px) {
          .left-drawer-overlay {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
