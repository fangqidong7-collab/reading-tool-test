"use client";

import React from "react";

interface SearchBarProps {
  isOpen: boolean;
  isDarkMode: boolean;
  headerTextColor: string;
  searchQuery: string;
  searchResults: Array<{ paragraphIndex: number; charIndex: number }>;
  currentSearchIndex: number;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  onQueryChange: (query: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

export function SearchBar({
  isOpen,
  isDarkMode,
  headerTextColor,
  searchQuery,
  searchResults,
  currentSearchIndex,
  searchInputRef,
  onQueryChange,
  onPrev,
  onNext,
  onClose,
}: SearchBarProps) {
  if (!isOpen) return null;

  return (
    <div 
      className={`search-bar ${isDarkMode ? "dark" : ""}`}
      style={{ 
        backgroundColor: isDarkMode ? "#1e1e2e" : "#f8f9fa",
        borderBottomColor: isDarkMode ? "#333" : "#e0e0e0",
      }}
    >
      <div className="search-container">
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="搜索全文..."
          className={`search-input ${isDarkMode ? "dark" : ""}`}
          style={{
            backgroundColor: isDarkMode ? "#2a2a3e" : "#fff",
            color: isDarkMode ? "#ccc" : "#333",
            borderColor: isDarkMode ? "#444" : "#ddd",
          }}
        />
        <div className="search-results-count" style={{ color: isDarkMode ? "#999" : "#666" }}>
          {searchResults.length > 0 ? (
            <>第 {currentSearchIndex + 1} / {searchResults.length} 个匹配</>
          ) : (
            searchQuery ? "无匹配" : ""
          )}
        </div>
        <button
          className={`search-nav-btn ${isDarkMode ? "dark" : ""}`}
          onClick={onPrev}
          disabled={searchResults.length === 0}
          title="上一个 (Shift+Enter)"
          style={{
            color: headerTextColor,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
        <button
          className={`search-nav-btn ${isDarkMode ? "dark" : ""}`}
          onClick={onNext}
          disabled={searchResults.length === 0}
          title="下一个 (Enter)"
          style={{
            color: headerTextColor,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <button
          className={`search-close-btn ${isDarkMode ? "dark" : ""}`}
          onClick={onClose}
          title="关闭 (ESC)"
          style={{
            color: headerTextColor,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <style jsx>{`
        .search-bar {
          position: fixed;
          top: 56px;
          left: 0;
          right: 0;
          background: #f8f9fa;
          border-bottom: 1px solid #e0e0e0;
          z-index: 800;
          padding: 8px 16px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .search-bar.dark {
          background: #1e1e2e;
          border-bottom-color: #333;
        }

        .search-container {
          display: flex;
          align-items: center;
          gap: 8px;
          max-width: 600px;
          margin: 0 auto;
        }

        .search-input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s;
        }

        .search-input:focus {
          border-color: #4a90d9;
        }

        .search-input.dark {
          background: #2a2a3e;
          border-color: #444;
          color: #ccc;
        }

        .search-results-count {
          font-size: 12px;
          white-space: nowrap;
          min-width: 100px;
          text-align: center;
        }

        .search-nav-btn {
          padding: 6px 8px;
          border: none;
          background: transparent;
          cursor: pointer;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;
        }

        .search-nav-btn:hover:not(:disabled) {
          background: rgba(0, 0, 0, 0.1);
        }

        .search-nav-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .search-close-btn {
          padding: 6px 8px;
          border: none;
          background: transparent;
          cursor: pointer;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;
        }

        .search-close-btn:hover {
          background: rgba(0, 0, 0, 0.1);
        }

        @media (max-width: 768px) {
          .search-bar {
            top: 48px;
          }
        }
      `}</style>
    </div>
  );
}
