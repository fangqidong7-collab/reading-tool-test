"use client";

import React from "react";

interface AnnotatedWord {
  root: string;
  meaning: string;
  pos: string;
  count: number;
}

interface VocabularySidebarProps {
  annotations: Record<string, AnnotatedWord>;
  isOpen: boolean;
  onClose: () => void;
  onClearAll: () => void;
  onWordClick: (word: string) => void;
  // Dark mode colors
  isDarkMode?: boolean;
  sidebarBg?: string;
  headerBg?: string;
  textColor?: string;
  annotationColor?: string;
  highlightBg?: string;
}

export function VocabularySidebar({
  annotations,
  isOpen,
  onClose,
  onClearAll,
  onWordClick,
  isDarkMode = false,
  sidebarBg = "#FFFFFF",
  headerBg = "#FFFFFF",
  textColor = "#333333",
  annotationColor = "#E74C3C",
  highlightBg = "#f8f9fa",
}: VocabularySidebarProps) {
  const annotationList = Object.values(annotations);
  const totalCount = annotationList.reduce((sum, item) => sum + item.count, 0);

  // Dark mode colors
  const colors = {
    sidebarBg,
    headerBg,
    borderColor: isDarkMode ? "#333" : "#eee",
    textColor,
    secondaryTextColor: isDarkMode ? "#888" : "#666",
    accentColor: isDarkMode ? "#6ba3e0" : "#4a90d9",
    highlightBg: isDarkMode ? "#2a2a3e" : highlightBg,
    hoverBg: isDarkMode ? "#3a3a4e" : "#e9ecef",
    emptyIconColor: isDarkMode ? "#666" : "#888",
  };

  return (
    <>
      {/* 侧边栏 */}
      <div
        className={`vocabulary-sidebar ${isOpen ? "open" : ""}`}
        style={{ backgroundColor: colors.sidebarBg }}
      >
        <div
          className="sidebar-header"
          style={{ backgroundColor: colors.headerBg, borderBottomColor: colors.borderColor }}
        >
          <h3 className="sidebar-title" style={{ color: textColor }}>
            已标注词汇
            <span className="sidebar-count" style={{ backgroundColor: colors.accentColor }}>
              {annotationList.length}
            </span>
          </h3>
          <button className="sidebar-close" onClick={onClose} style={{ color: colors.secondaryTextColor }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="sidebar-stats" style={{ backgroundColor: colors.highlightBg }}>
          <div className="stat-item">
            <span className="stat-value" style={{ color: colors.accentColor }}>
              {annotationList.length}
            </span>
            <span className="stat-label" style={{ color: colors.secondaryTextColor }}>词汇数</span>
          </div>
          <div className="stat-item">
            <span className="stat-value" style={{ color: colors.accentColor }}>
              {totalCount}
            </span>
            <span className="stat-label" style={{ color: colors.secondaryTextColor }}>标注次数</span>
          </div>
        </div>

        {annotationList.length > 0 ? (
          <>
            <div className="vocabulary-list">
              {annotationList.map((item) => (
                <div
                  key={item.root}
                  className="vocabulary-item"
                  onClick={() => onWordClick(item.root)}
                  style={{ backgroundColor: colors.highlightBg }}
                >
                  <div className="item-header">
                    <span className="item-root" style={{ color: textColor }}>
                      {item.root}
                    </span>
                    <span className="item-pos" style={{ color: colors.secondaryTextColor }}>
                      {item.pos}
                    </span>
                    <span
                      className="item-count"
                      style={{
                        color: colors.accentColor,
                        backgroundColor: `${colors.accentColor}20`,
                      }}
                    >
                      {item.count}次
                    </span>
                  </div>
                  <div className="item-meaning" style={{ color: annotationColor }}>
                    {item.meaning}
                  </div>
                </div>
              ))}
            </div>

            <div className="sidebar-footer" style={{ borderTopColor: colors.borderColor }}>
              <button
                className="clear-all-btn"
                onClick={onClearAll}
                style={{
                  backgroundColor: colors.highlightBg,
                  borderColor: colors.borderColor,
                  color: colors.secondaryTextColor,
                }}
              >
                清除所有标注
              </button>
            </div>
          </>
        ) : (
          <div className="empty-state" style={{ color: colors.emptyIconColor }}>
            <div className="empty-icon">📚</div>
            <p style={{ color: colors.secondaryTextColor }}>点击阅读区的单词，然后选择&quot;标注全文&quot;</p>
            <p className="empty-hint" style={{ color: isDarkMode ? "#555" : "#aaa" }}>
              系统会自动标注所有同词根的单词
            </p>
          </div>
        )}
      </div>

      {/* 手机端切换按钮 */}
      <button
        className="mobile-toggle"
        onClick={isOpen ? onClose : () => {}}
        style={{ display: "none" }}
      >
        📚 词汇表
      </button>

      <style jsx>{`
        .vocabulary-sidebar {
          position: fixed;
          right: 0;
          top: 0;
          bottom: 0;
          width: 300px;
          box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
          display: flex;
          flex-direction: column;
          z-index: 100;
          transform: translateX(100%);
          transition: transform 0.3s ease;
        }

        .vocabulary-sidebar.open {
          transform: translateX(0);
        }

        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid;
        }

        .sidebar-title {
          font-size: 16px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
        }

        .sidebar-count {
          color: white;
          font-size: 12px;
          padding: 2px 8px;
          border-radius: 10px;
        }

        .sidebar-close {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.15s;
        }

        .sidebar-close:hover {
          opacity: 0.7;
        }

        .sidebar-stats {
          display: flex;
          gap: 20px;
          padding: 16px 20px;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
        }

        .stat-value {
          font-size: 24px;
          font-weight: 700;
        }

        .stat-label {
          font-size: 12px;
        }

        .vocabulary-list {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
        }

        .vocabulary-item {
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .vocabulary-item:hover {
          opacity: 0.9;
        }

        .item-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }

        .item-root {
          font-family: Georgia, serif;
          font-weight: 600;
          font-size: 16px;
        }

        .item-pos {
          font-size: 11px;
        }

        .item-count {
          margin-left: auto;
          font-size: 12px;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .item-meaning {
          font-size: 14px;
        }

        .sidebar-footer {
          padding: 16px 20px;
          border-top: 1px solid;
        }

        .clear-all-btn {
          width: 100%;
          padding: 10px;
          border: 1px solid;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .clear-all-btn:hover {
          background: #e74c3c !important;
          color: white !important;
          border-color: #e74c3c !important;
        }

        .empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          text-align: center;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .empty-state p {
          margin: 0 0 8px;
          font-size: 14px;
        }

        .empty-hint {
          font-size: 12px !important;
        }

        @media (max-width: 768px) {
          .vocabulary-sidebar {
            width: 100%;
            max-width: 320px;
          }
        }
      `}</style>
    </>
  );
}
