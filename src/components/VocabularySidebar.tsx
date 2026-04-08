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
}

export function VocabularySidebar({
  annotations,
  isOpen,
  onClose,
  onClearAll,
  onWordClick,
}: VocabularySidebarProps) {
  const annotationList = Object.values(annotations);
  const totalCount = annotationList.reduce((sum, item) => sum + item.count, 0);
  
  return (
    <>
      {/* 侧边栏 */}
      <div className={`vocabulary-sidebar ${isOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <h3 className="sidebar-title">
            已标注词汇
            <span className="sidebar-count">{annotationList.length}</span>
          </h3>
          <button className="sidebar-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div className="sidebar-stats">
          <div className="stat-item">
            <span className="stat-value">{annotationList.length}</span>
            <span className="stat-label">词汇数</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{totalCount}</span>
            <span className="stat-label">标注次数</span>
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
                >
                  <div className="item-header">
                    <span className="item-root">{item.root}</span>
                    <span className="item-pos">{item.pos}</span>
                    <span className="item-count">{item.count}次</span>
                  </div>
                  <div className="item-meaning">{item.meaning}</div>
                </div>
              ))}
            </div>
            
            <div className="sidebar-footer">
              <button className="clear-all-btn" onClick={onClearAll}>
                清除所有标注
              </button>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📚</div>
            <p>点击阅读区的单词，然后选择&quot;标注全文&quot;</p>
            <p className="empty-hint">
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
          background: white;
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
          border-bottom: 1px solid #eee;
        }
        
        .sidebar-title {
          font-size: 16px;
          font-weight: 600;
          color: #333;
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
        }
        
        .sidebar-count {
          background: #4a90d9;
          color: white;
          font-size: 12px;
          padding: 2px 8px;
          border-radius: 10px;
        }
        
        .sidebar-close {
          background: none;
          border: none;
          cursor: pointer;
          color: #666;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .sidebar-close:hover {
          color: #333;
        }
        
        .sidebar-stats {
          display: flex;
          gap: 20px;
          padding: 16px 20px;
          background: #f8f9fa;
        }
        
        .stat-item {
          display: flex;
          flex-direction: column;
        }
        
        .stat-value {
          font-size: 24px;
          font-weight: 700;
          color: #4a90d9;
        }
        
        .stat-label {
          font-size: 12px;
          color: #888;
        }
        
        .vocabulary-list {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
        }
        
        .vocabulary-item {
          padding: 12px;
          background: #f8f9fa;
          border-radius: 8px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }
        
        .vocabulary-item:hover {
          background: #e9ecef;
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
          color: #333;
        }
        
        .item-pos {
          font-size: 11px;
          color: #888;
        }
        
        .item-count {
          margin-left: auto;
          font-size: 12px;
          color: #4a90d9;
          background: rgba(74, 144, 217, 0.1);
          padding: 2px 6px;
          border-radius: 4px;
        }
        
        .item-meaning {
          font-size: 14px;
          color: #e74c3c;
        }
        
        .sidebar-footer {
          padding: 16px 20px;
          border-top: 1px solid #eee;
        }
        
        .clear-all-btn {
          width: 100%;
          padding: 10px;
          background: #f8f9fa;
          border: 1px solid #ddd;
          border-radius: 6px;
          color: #666;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        
        .clear-all-btn:hover {
          background: #e74c3c;
          color: white;
          border-color: #e74c3c;
        }
        
        .empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          text-align: center;
          color: #888;
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
          color: #aaa;
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
