"use client";

import React, { useCallback } from "react";
import { AnnotatedWord } from "@/hooks/useTextAnnotation";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  annotations: Record<string, AnnotatedWord>;
  onRemove: (word: string) => void;
  onClearAll: () => void;
  onScrollToWord: (word: string) => void;
}

export function Sidebar({
  isOpen,
  onToggle,
  annotations,
  onRemove,
  onClearAll,
  onScrollToWord,
}: SidebarProps) {
  const annotationList = Object.values(annotations);
  
  const handleWordClick = useCallback(
    (word: string) => {
      onScrollToWord(word);
    },
    [onScrollToWord]
  );
  
  const handleRemove = useCallback(
    (e: React.MouseEvent, word: string) => {
      e.stopPropagation();
      onRemove(word);
    },
    [onRemove]
  );
  
  return (
    <>
      <button
        className="sidebar-toggle"
        onClick={onToggle}
        aria-label={isOpen ? "收起侧边栏" : "展开侧边栏"}
      >
        {isOpen ? "›" : "‹"}
      </button>
      
      <aside className={`sidebar ${isOpen ? "open" : "closed"}`}>
        <div className="sidebar-header">
          <h3>已标注词汇</h3>
          <span className="count-badge">{annotationList.length}</span>
        </div>
        
        {annotationList.length === 0 ? (
          <div className="empty-state">
            <p>暂无标注</p>
            <p className="hint">点击单词开始标注</p>
          </div>
        ) : (
          <>
            <div className="annotation-list">
              {annotationList.map((item) => (
                <div
                  key={item.root}
                  className="annotation-item"
                  onClick={() => handleWordClick(item.root)}
                >
                  <div className="item-header">
                    <span className="item-root">{item.root}</span>
                    <span className="item-count">×{item.count}</span>
                  </div>
                  <div className="item-meaning">
                    <span className="pos-tag">{item.pos}</span>
                    {item.meaning}
                  </div>
                  <button
                    className="item-remove"
                    onClick={(e) => handleRemove(e, item.root)}
                    aria-label="移除标注"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            
            <div className="sidebar-footer">
              <button className="clear-all-btn" onClick={onClearAll}>
                清除全部标注
              </button>
            </div>
          </>
        )}
      </aside>
      
      <style jsx>{`
        .sidebar-toggle {
          position: fixed;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 24px;
          height: 48px;
          background: #4a90d9;
          color: white;
          border: none;
          border-radius: 4px 0 0 4px;
          cursor: pointer;
          font-size: 16px;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: right 0.3s ease;
        }
        
        .sidebar {
          position: fixed;
          right: 0;
          top: 60px;
          bottom: 0;
          width: 280px;
          background: white;
          box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
          display: flex;
          flex-direction: column;
          transition: transform 0.3s ease;
          z-index: 99;
        }
        
        .sidebar.closed {
          transform: translateX(100%);
        }
        
        .sidebar.open {
          transform: translateX(0);
        }
        
        .sidebar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid #eee;
        }
        
        .sidebar-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #333;
        }
        
        .count-badge {
          background: #4a90d9;
          color: white;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 12px;
        }
        
        .empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #999;
          padding: 20px;
          text-align: center;
        }
        
        .empty-state p {
          margin: 4px 0;
        }
        
        .empty-state .hint {
          font-size: 12px;
          color: #bbb;
        }
        
        .annotation-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }
        
        .annotation-item {
          position: relative;
          padding: 12px;
          background: #f9f9f9;
          border-radius: 6px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: background 0.2s ease;
        }
        
        .annotation-item:hover {
          background: #f0f7ff;
        }
        
        .item-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }
        
        .item-root {
          font-family: Georgia, serif;
          font-size: 15px;
          font-weight: 600;
          color: #333;
        }
        
        .item-count {
          font-size: 11px;
          color: #999;
          background: #eee;
          padding: 2px 6px;
          border-radius: 8px;
        }
        
        .item-meaning {
          font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
          font-size: 13px;
          color: #666;
          line-height: 1.4;
          display: flex;
          align-items: flex-start;
          gap: 6px;
        }
        
        .pos-tag {
          background: #4a90d9;
          color: white;
          padding: 1px 4px;
          border-radius: 2px;
          font-size: 10px;
          flex-shrink: 0;
        }
        
        .item-remove {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 18px;
          height: 18px;
          border: none;
          background: transparent;
          color: #ccc;
          font-size: 14px;
          cursor: pointer;
          padding: 0;
          line-height: 1;
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        
        .annotation-item:hover .item-remove {
          opacity: 1;
        }
        
        .item-remove:hover {
          color: #e74c3c;
        }
        
        .sidebar-footer {
          padding: 12px;
          border-top: 1px solid #eee;
        }
        
        .clear-all-btn {
          width: 100%;
          padding: 10px;
          background: #f5f5f5;
          border: none;
          border-radius: 4px;
          color: #666;
          font-size: 13px;
          cursor: pointer;
          transition: background 0.2s ease;
        }
        
        .clear-all-btn:hover {
          background: #e0e0e0;
        }
        
        @media (max-width: 768px) {
          .sidebar {
            width: 100%;
            top: auto;
            bottom: 0;
            height: 50vh;
            border-radius: 16px 16px 0 0;
            transform: translateY(${isOpen ? "0" : "100%"});
          }
          
          .sidebar-toggle {
            top: auto;
            bottom: 20px;
            right: 20px;
            width: 44px;
            height: 44px;
            border-radius: 22px;
            font-size: 20px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
          }
        }
      `}</style>
    </>
  );
}
