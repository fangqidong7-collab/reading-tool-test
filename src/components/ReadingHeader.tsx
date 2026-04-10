"use client";

import React from "react";
import type { TocEntry, BookmarkEntry } from "@/hooks/useBookshelf";

interface ReadingHeaderProps {
  bookTitle: string;
  isDarkMode: boolean;
  headerBg: string;
  headerTextColor: string;
  searchOpen: boolean;
  sidebarOpen: boolean;
  settingsPanelOpen: boolean;
  leftDrawerOpen: boolean;
  leftDrawerTab: 'toc' | 'bookmarks';
  moreMenuOpen: boolean;
  dictLoadStatus: 'idle' | 'loading' | 'loaded' | 'failed';
  annotationsCount: number;
  currentScrollPercent: number;
  bookmarks: BookmarkEntry[];
  onBack: () => void;
  onTocClick: () => void;
  onSearchToggle: () => void;
  onSearchFocus: () => void;
  onMoreMenuToggle: () => void;
  onSettingsToggle: () => void;
  onBookmarkClick: () => void;
  onSidebarToggle: () => void;
}

export function ReadingHeader({
  bookTitle,
  isDarkMode,
  headerBg,
  headerTextColor,
  searchOpen,
  sidebarOpen,
  settingsPanelOpen,
  leftDrawerOpen,
  leftDrawerTab,
  moreMenuOpen,
  dictLoadStatus,
  annotationsCount,
  currentScrollPercent,
  bookmarks,
  onBack,
  onTocClick,
  onSearchToggle,
  onSearchFocus,
  onMoreMenuToggle,
  onSettingsToggle,
  onBookmarkClick,
  onSidebarToggle,
}: ReadingHeaderProps) {
  return (
    <>
      {/* Mobile More Menu Dropdown */}
      {moreMenuOpen && (
        <>
          <div className="more-menu-overlay" onClick={onMoreMenuToggle} />
          <div className={`more-menu-dropdown ${isDarkMode ? 'dark' : ''}`} style={{ backgroundColor: isDarkMode ? "#2a2a3e" : "#ffffff" }}>
            <button
              className="more-menu-item"
              onClick={() => {
                onTocClick();
                onMoreMenuToggle();
              }}
              style={{ color: isDarkMode ? "#ccc" : "#333" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              目录
            </button>
            <button
              className="more-menu-item"
              onClick={onBookmarkClick}
              style={{ color: isDarkMode ? "#ccc" : "#333" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill={bookmarks.some(bm => bm.page === currentScrollPercent) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              书签
            </button>
            <button
              className="more-menu-item"
              onClick={() => {
                onSearchToggle();
                onSearchFocus();
                onMoreMenuToggle();
              }}
              style={{ color: isDarkMode ? "#ccc" : "#333" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              搜索
            </button>
          </div>
        </>
      )}

      <header className="app-header" style={{ backgroundColor: headerBg, color: headerTextColor }}>
        <div className="header-left">
          <button 
            className="back-btn" 
            onClick={onBack}
            style={{ 
              backgroundColor: isDarkMode ? "#2a2a3e" : "#f5f5f5",
              color: isDarkMode ? "#ccc" : "#666",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          
          {/* TOC Button - Hidden on mobile */}
          <button 
            className={`toc-btn nav-btn-catalog ${isDarkMode ? 'dark' : ''}`}
            onClick={onTocClick}
            style={{ 
              backgroundColor: leftDrawerOpen && leftDrawerTab === 'toc' ? (isDarkMode ? "#3a3a4e" : "#e0e0e0") : "transparent",
              borderColor: isDarkMode ? "#444" : "#ddd",
              color: headerTextColor,
            }}
            title="目录"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
          
          <h1 className="app-title" title={bookTitle} style={{ color: headerTextColor }}>
            {bookTitle.length > 15 ? bookTitle.substring(0, 15) + '...' : bookTitle}
          </h1>
        </div>
        
        <div className="header-right">
          {/* Search Button */}
          <button
            className={`search-btn ${isDarkMode ? "dark" : ""}`}
            onClick={() => {
              onSearchToggle();
              if (!searchOpen) {
                onSearchFocus();
              }
            }}
            title="搜索全文 (Ctrl+F)"
            style={{ 
              backgroundColor: searchOpen ? (isDarkMode ? "#3a3a4e" : "#e0e0e0") : "transparent",
              borderColor: isDarkMode ? "#444" : "#ddd",
              color: headerTextColor,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>

          {/* More Menu Button - Only visible on mobile */}
          <button
            className={`more-menu-btn nav-btn-more ${isDarkMode ? "dark" : ""}`}
            onClick={onMoreMenuToggle}
            title="更多"
            style={{ 
              backgroundColor: moreMenuOpen ? (isDarkMode ? "#3a3a4e" : "#e0e0e0") : "transparent",
              borderColor: isDarkMode ? "#444" : "#ddd",
              color: headerTextColor,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="1" />
              <circle cx="19" cy="12" r="1" />
              <circle cx="5" cy="12" r="1" />
            </svg>
          </button>

          {/* Settings Button - Hidden on mobile */}
          <button
            className="settings-btn nav-btn-font"
            onClick={onSettingsToggle}
            title="阅读设置"
            style={{ 
              backgroundColor: settingsPanelOpen ? (isDarkMode ? "#3a3a4e" : "#e0e0e0") : "transparent",
              borderColor: isDarkMode ? "#444" : "#ddd",
              color: headerTextColor,
            }}
          >
            <span style={{ fontSize: "14px", fontWeight: "bold" }}>Aa</span>
          </button>

          {/* Bookmark Button - Hidden on mobile */}
          <button
            className={`bookmark-btn nav-btn-bookmark ${isDarkMode ? 'dark' : ''}`}
            onClick={onBookmarkClick}
            title="书签"
            style={{ 
              backgroundColor: leftDrawerOpen && leftDrawerTab === 'bookmarks' ? (isDarkMode ? "#3a3a4e" : "#e0e0e0") : "transparent",
              borderColor: isDarkMode ? "#444" : "#ddd",
              color: headerTextColor,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill={bookmarks.some(bm => bm.page === currentScrollPercent) ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </button>

          {/* Dictionary Loading Status */}
          {dictLoadStatus !== 'idle' && (
            <div className={`dict-status dict-status-${dictLoadStatus}`}>
              {dictLoadStatus === 'loading' && (
                <>
                  <span className="dict-status-spinner"></span>
                  <span>词典加载中...</span>
                </>
              )}
              {dictLoadStatus === 'loaded' && (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>词典已就绪</span>
                </>
              )}
              {dictLoadStatus === 'failed' && (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  <span>词典加载失败</span>
                </>
              )}
            </div>
          )}

          <div className="header-stats" style={{ color: isDarkMode ? "#999" : "#666" }}>
            <span className="stat">
              词汇: <strong style={{ color: isDarkMode ? "#6ba3e0" : "#4a90d9" }}>
                {annotationsCount}
              </strong>
            </span>
          </div>
          <button
            className={`sidebar-toggle nav-btn-vocab ${isDarkMode ? "dark" : ""}`}
            onClick={onSidebarToggle}
            title={sidebarOpen ? "收起词汇表" : "展开词汇表"}
            style={{ 
              backgroundColor: sidebarOpen ? (isDarkMode ? "#3a3a4e" : "#e0e0e0") : "transparent",
              borderColor: isDarkMode ? "#444" : "#ddd",
              color: headerTextColor,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="15" y1="3" x2="15" y2="21" />
            </svg>
          </button>
        </div>
      </header>

      <style jsx>{`
        .more-menu-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.3);
          z-index: 999;
        }

        .more-menu-dropdown {
          position: fixed;
          top: 56px;
          right: 16px;
          width: 160px;
          background: #ffffff;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          overflow: hidden;
        }

        .more-menu-dropdown.dark {
          background: #2a2a3e;
        }

        .more-menu-dropdown.dark .more-menu-item:hover {
          background: #3a3a4e;
        }

        .more-menu-item {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 12px 16px;
          border: none;
          background: transparent;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.15s;
        }

        .more-menu-item:hover {
          background: #f0f0f0;
        }
      `}</style>
    </>
  );
}
