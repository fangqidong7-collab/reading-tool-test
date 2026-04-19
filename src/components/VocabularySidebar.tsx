"use client";

import React, { useState } from "react";
import { speakWord } from "@/lib/speak";
import type { SentenceAnnotation } from "@/hooks/useBookshelf";

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
  // Sentence translation props
  sentenceAnnotations?: SentenceAnnotation[];
  onSentenceClick?: (annotation: SentenceAnnotation) => void;
  onRemoveSentence?: (id: string) => void;
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
  sentenceAnnotations = [],
  onSentenceClick,
  onRemoveSentence,
  isDarkMode = false,
  sidebarBg = "#FFFFFF",
  headerBg = "#FFFFFF",
  textColor = "#333333",
  annotationColor = "#E74C3C",
  highlightBg = "#f8f9fa",
}: VocabularySidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarTab, setSidebarTab] = useState<"words" | "sentences">("words");

  const annotationList = Object.values(annotations);
  const totalCount = annotationList.reduce((sum, item) => sum + item.count, 0);

  // 搜索过滤
  const filteredList = searchQuery.trim()
    ? annotationList.filter(
        (item) =>
          item.root.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.meaning.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : annotationList;

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
          <div className="sidebar-header-row">
            <h3 className="sidebar-title" style={{ color: textColor }}>
              {sidebarTab === "words" ? "已标注词汇" : "句子翻译"}
              <span className="sidebar-count" style={{ backgroundColor: colors.accentColor }}>
                {sidebarTab === "words" ? annotationList.length : sentenceAnnotations.length}
              </span>
            </h3>
            <button className="sidebar-close" onClick={onClose} style={{ color: colors.secondaryTextColor }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          {/* Tab 切换 */}
          <div className="sidebar-tabs" style={{ borderTopColor: colors.borderColor }}>
            <button
              className={`sidebar-tab ${sidebarTab === "words" ? "active" : ""}`}
              onClick={() => setSidebarTab("words")}
              style={{
                color: sidebarTab === "words" ? colors.accentColor : colors.secondaryTextColor,
                borderBottomColor: sidebarTab === "words" ? colors.accentColor : "transparent",
              }}
            >
              已标注词汇
            </button>
            <button
              className={`sidebar-tab ${sidebarTab === "sentences" ? "active" : ""}`}
              onClick={() => setSidebarTab("sentences")}
              style={{
                color: sidebarTab === "sentences" ? colors.accentColor : colors.secondaryTextColor,
                borderBottomColor: sidebarTab === "sentences" ? colors.accentColor : "transparent",
              }}
            >
              句子翻译
            </button>
          </div>
        </div>

        {/* 词汇 Tab 统计区 */}
        {sidebarTab === "words" && (
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
        )}

        {/* 句子 Tab 统计区 */}
        {sidebarTab === "sentences" && (
          <div className="sidebar-stats" style={{ backgroundColor: colors.highlightBg }}>
            <div className="stat-item">
              <span className="stat-value" style={{ color: colors.accentColor }}>
                {sentenceAnnotations.length}
              </span>
              <span className="stat-label" style={{ color: colors.secondaryTextColor }}>句子数</span>
            </div>
          </div>
        )}

        {/* 词汇 Tab 搜索框 */}
        {sidebarTab === "words" && annotationList.length > 0 && (
          <div className="sidebar-search" style={{ borderBottomColor: colors.borderColor }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="搜索单词..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="sidebar-search-input"
              style={{ color: textColor }}
            />
            {searchQuery && (
              <button className="sidebar-search-clear" onClick={() => setSearchQuery("")}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* 词汇 Tab 列表 */}
        {sidebarTab === "words" && (
          annotationList.length > 0 ? (
            <>
              <div className="vocabulary-list">
                {filteredList.map((item) => (
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
                      {/* 发音按钮 */}
                      <button
                        className="sidebar-speak-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          speakWord(item.root);
                        }}
                        title="播放发音"
                        style={{ color: colors.accentColor }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                        </svg>
                      </button>
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
          )
        )}

        {/* 句子 Tab 列表 */}
        {sidebarTab === "sentences" && (
          sentenceAnnotations.length > 0 ? (
            <div className="sentence-list">
              {sentenceAnnotations.map((item) => (
                <div
                  key={item.id}
                  className="sentence-item"
                  onClick={() => onSentenceClick?.(item)}
                  style={{ backgroundColor: colors.highlightBg }}
                >
                  <div className="sentence-meta" style={{ color: colors.secondaryTextColor }}>
                    第 {item.startParagraphIndex + 1} 段
                  </div>
                  <div
                    className="sentence-original"
                    style={{ color: textColor }}
                    title={item.originalText}
                  >
                    {item.originalText}
                  </div>
                  <div className="sentence-translation" style={{ color: annotationColor }}>
                    {item.translation}
                  </div>
                  <button
                    className="sentence-remove-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveSentence?.(item.id);
                    }}
                    title="删除"
                    style={{ color: colors.secondaryTextColor }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ color: colors.emptyIconColor }}>
              <div className="empty-icon">💬</div>
              <p style={{ color: colors.secondaryTextColor }}>
                选中句子使用翻译后，句子会出现在这里
              </p>
              <p className="empty-hint" style={{ color: isDarkMode ? "#555" : "#aaa" }}>
                长按选中文本后点击「翻译」即可保存
              </p>
            </div>
          )
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
          flex-direction: column;
          border-bottom: 1px solid;
        }

        .sidebar-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px 8px;
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

        .sidebar-tabs {
          display: flex;
          padding: 0 20px;
          border-top: 1px solid;
        }

        .sidebar-tab {
          background: none;
          border: none;
          padding: 8px 12px;
          font-size: 14px;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: color 0.15s ease, border-color 0.15s ease;
          margin-bottom: -1px;
        }

        .sidebar-tab:hover {
          opacity: 0.8;
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

        .sidebar-search {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-bottom: 1px solid;
        }

        .sidebar-search-input {
          flex: 1;
          border: none;
          outline: none;
          font-size: 14px;
          background: transparent;
        }

        .sidebar-search-input::placeholder {
          color: #bbb;
        }

        .sidebar-search-clear {
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px;
          display: flex;
          align-items: center;
        }

        .sidebar-speak-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          opacity: 0.6;
          transition: opacity 0.15s ease;
          flex-shrink: 0;
        }

        .sidebar-speak-btn:hover {
          opacity: 1;
        }

        .sidebar-speak-btn:active {
          transform: scale(0.9);
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

        .sentence-list {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
        }

        .sentence-item {
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: background-color 0.15s ease;
          position: relative;
        }

        .sentence-item:hover {
          opacity: 0.9;
        }

        .sentence-meta {
          font-size: 11px;
          margin-bottom: 4px;
        }

        .sentence-original {
          font-size: 13px;
          line-height: 1.5;
          margin-bottom: 6px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sentence-translation {
          font-size: 13px;
          line-height: 1.5;
        }

        .sentence-remove-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          opacity: 0.5;
          transition: opacity 0.15s ease;
        }

        .sentence-remove-btn:hover {
          opacity: 1;
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
