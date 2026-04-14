"use client";

import React, { useState } from "react";
import { speakWord } from "@/lib/speak";

interface VocabItem {
  root: string;
  meaning: string;
  pos: string;
}

interface GlobalVocabularyPageProps {
  vocabulary: Record<string, VocabItem>;
  onRemoveWord: (root: string) => void;
  onClearAll: () => void;
  backgroundColor?: string;
}

export function GlobalVocabularyPage({
  vocabulary,
  onRemoveWord,
  onClearAll,
  backgroundColor = "#FFF8F0",
}: GlobalVocabularyPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const vocabList = Object.values(vocabulary);

  // 搜索过滤
  const filteredList = searchQuery.trim()
    ? vocabList.filter(
        (item) =>
          item.root.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.meaning.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : vocabList;

  // 按字母排序
  const sortedList = [...filteredList].sort((a, b) =>
    a.root.localeCompare(b.root)
  );

  return (
    <div className="global-vocab-page" style={{ backgroundColor }}>
      <div className="global-vocab-container">
        {/* 顶部标题栏 */}
        <div className="global-vocab-header">
          <div className="global-vocab-header-left">
            <h1 className="global-vocab-title">全局词汇表</h1>
            <span className="global-vocab-count">{vocabList.length} 词</span>
          </div>
          {vocabList.length > 0 && (
            <button
              className="global-vocab-clear-btn"
              onClick={() => setShowConfirmClear(true)}
            >
              清空全部
            </button>
          )}
        </div>

        {/* 搜索框 */}
        {vocabList.length > 0 && (
          <div className="global-vocab-search">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#999"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="搜索单词或释义..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="global-vocab-search-input"
            />
            {searchQuery && (
              <button
                className="global-vocab-search-clear"
                onClick={() => setSearchQuery("")}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#999"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* 词汇列表 */}
        {sortedList.length > 0 ? (
          <div className="global-vocab-list">
            {sortedList.map((item) => (
              <div key={item.root} className="global-vocab-item">
                <div className="global-vocab-item-left">
                  <span className="global-vocab-word">{item.root}</span>
                  <span className="global-vocab-meaning">{item.meaning}</span>
                </div>
                {/* 发音按钮 */}
                <button
                  className="global-vocab-speak-btn"
                  onClick={() => speakWord(item.root)}
                  title="播放发音"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                </button>
                <button
                  className="global-vocab-delete-btn"
                  onClick={() => onRemoveWord(item.root)}
                  title="删除此词"
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
              </div>
            ))}
          </div>
        ) : (
          <div className="global-vocab-empty">
            <div className="global-vocab-empty-icon">📖</div>
            {searchQuery ? (
              <p>没有找到匹配的单词</p>
            ) : (
              <>
                <p>还没有标注任何单词</p>
                <p className="global-vocab-empty-hint">
                  打开一本书，点击单词并选择「标注全文」，标注的词会自动出现在这里
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* 确认清空弹窗 */}
      {showConfirmClear && (
        <div
          className="global-vocab-confirm-overlay"
          onClick={() => setShowConfirmClear(false)}
        >
          <div
            className="global-vocab-confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="global-vocab-confirm-text">
              确定要清空全部 {vocabList.length} 个单词吗？此操作不可撤销。
            </p>
            <div className="global-vocab-confirm-buttons">
              <button
                className="global-vocab-confirm-cancel"
                onClick={() => setShowConfirmClear(false)}
              >
                取消
              </button>
              <button
                className="global-vocab-confirm-ok"
                onClick={() => {
                  onClearAll();
                  setShowConfirmClear(false);
                }}
              >
                确定清空
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .global-vocab-page {
          min-height: 100vh;
          min-height: 100dvh;
          overflow-y: auto;
          padding-bottom: 80px;
        }

        .global-vocab-container {
          max-width: 600px;
          margin: 0 auto;
          padding: 24px 16px;
        }

        .global-vocab-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .global-vocab-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .global-vocab-title {
          font-size: 24px;
          font-weight: 700;
          color: #333;
          margin: 0;
        }

        .global-vocab-count {
          font-size: 13px;
          color: #4a90d9;
          background: rgba(74, 144, 217, 0.1);
          padding: 3px 10px;
          border-radius: 12px;
          font-weight: 500;
        }

        .global-vocab-clear-btn {
          padding: 6px 14px;
          background: none;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 13px;
          color: #999;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .global-vocab-clear-btn:hover {
          border-color: #e74c3c;
          color: #e74c3c;
          background: rgba(231, 76, 60, 0.05);
        }

        .global-vocab-search {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 10px;
          margin-bottom: 16px;
        }

        .global-vocab-search-input {
          flex: 1;
          border: none;
          outline: none;
          font-size: 15px;
          color: #333;
          background: transparent;
        }

        .global-vocab-search-input::placeholder {
          color: #bbb;
        }

        .global-vocab-search-clear {
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px;
          display: flex;
          align-items: center;
        }

        .global-vocab-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .global-vocab-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          background: white;
          border-radius: 10px;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
          transition: box-shadow 0.15s ease;
        }

        .global-vocab-item:hover {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .global-vocab-item-left {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
          min-width: 0;
        }

        .global-vocab-word {
          font-size: 17px;
          font-weight: 600;
          color: #333;
          font-family: Georgia, "Times New Roman", serif;
        }

        .global-vocab-meaning {
          font-size: 14px;
          color: #e74c3c;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .global-vocab-speak-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 6px;
          color: #4a90d9;
          border-radius: 6px;
          transition: all 0.15s ease;
          flex-shrink: 0;
          opacity: 0.6;
        }

        .global-vocab-speak-btn:hover {
          opacity: 1;
          background: rgba(74, 144, 217, 0.08);
        }

        .global-vocab-speak-btn:active {
          transform: scale(0.9);
        }

        .global-vocab-delete-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 6px;
          color: #ccc;
          border-radius: 6px;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }

        .global-vocab-delete-btn:hover {
          color: #e74c3c;
          background: rgba(231, 76, 60, 0.08);
        }

        .global-vocab-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 20px;
          text-align: center;
        }

        .global-vocab-empty-icon {
          font-size: 56px;
          margin-bottom: 16px;
        }

        .global-vocab-empty p {
          margin: 0 0 8px;
          font-size: 16px;
          color: #888;
        }

        .global-vocab-empty-hint {
          font-size: 13px !important;
          color: #bbb !important;
          max-width: 280px;
          line-height: 1.5;
        }

        .global-vocab-confirm-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .global-vocab-confirm-modal {
          background: white;
          border-radius: 14px;
          padding: 24px;
          max-width: 320px;
          width: 100%;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        }

        .global-vocab-confirm-text {
          margin: 0 0 20px;
          font-size: 15px;
          color: #333;
          line-height: 1.5;
          text-align: center;
        }

        .global-vocab-confirm-buttons {
          display: flex;
          gap: 12px;
        }

        .global-vocab-confirm-cancel {
          flex: 1;
          padding: 10px;
          background: #f5f5f5;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 14px;
          color: #666;
          cursor: pointer;
        }

        .global-vocab-confirm-cancel:hover {
          background: #e8e8e8;
        }

        .global-vocab-confirm-ok {
          flex: 1;
          padding: 10px;
          background: #e74c3c;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          color: white;
          cursor: pointer;
        }

        .global-vocab-confirm-ok:hover {
          background: #d63a2e;
        }

        @media (max-width: 768px) {
          .global-vocab-container {
            padding: 16px 12px;
          }

          .global-vocab-title {
            font-size: 20px;
          }
        }
      `}</style>
    </div>
  );
}
