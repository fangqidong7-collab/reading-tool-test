"use client";

import React, { useState } from "react";
import { useTextAnnotation } from "@/hooks/useTextAnnotation";
import { ReadingArea } from "@/components/ReadingArea";
import { WordTooltip } from "@/components/WordTooltip";
import { VocabularySidebar } from "@/components/VocabularySidebar";

export default function Home() {
  const {
    text,
    annotations,
    selectedWord,
    loading,
    sidebarOpen,
    containerRef,
    handleWordClick,
    annotateAll,
    removeAnnotation,
    clearAllAnnotations,
    handleFileUpload,
    setCustomText,
    closeTooltip,
    scrollToWord,
    getWordAnnotation,
    isClickable,
    setSidebarOpen,
  } = useTextAnnotation();
  
  const [showInput, setShowInput] = useState(false);
  const [customText, setCustomTextLocal] = useState("");
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
      setShowInput(false);
    }
  };
  
  const handleStartReading = () => {
    if (customText.trim()) {
      setCustomText(customText.trim());
      setShowInput(false);
    }
  };
  
  return (
    <div className="app-container">
      {/* 顶部导航 */}
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">英语阅读标注助手</h1>
        </div>
        <div className="header-right">
          <div className="header-stats">
            <span className="stat">
              词汇: <strong>{Object.keys(annotations).length}</strong>
            </span>
          </div>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? "收起侧边栏" : "展开侧边栏"}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="15" y1="3" x2="15" y2="21"></line>
            </svg>
          </button>
          <button
            className="upload-btn"
            onClick={() => setShowInput(!showInput)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            上传文件
          </button>
        </div>
      </header>
      
      {/* 上传区域 */}
      {showInput && (
        <div className="input-panel">
          <div className="input-section">
            <h3>上传文本文件</h3>
            <p className="input-hint">支持 .txt 格式 (UTF-8编码)</p>
            <input
              type="file"
              accept=".txt"
              onChange={handleFileChange}
              className="file-input"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="file-label">
              选择文件
            </label>
          </div>
          <div className="input-divider">或</div>
          <div className="input-section">
            <h3>粘贴文本</h3>
            <textarea
              className="text-input"
              placeholder="在此粘贴英文文本..."
              value={customText}
              onChange={(e) => setCustomTextLocal(e.target.value)}
              rows={6}
            />
            <button
              className="start-btn"
              onClick={handleStartReading}
              disabled={!customText.trim()}
            >
              开始阅读
            </button>
          </div>
        </div>
      )}
      
      {/* 主内容区 */}
      <main className="main-content">
        <div 
          ref={containerRef}
          className="reading-container"
        >
          {text ? (
            <ReadingArea
              text={text}
              annotations={annotations}
              onWordClick={handleWordClick}
              getWordAnnotation={getWordAnnotation}
              isClickable={isClickable}
            />
          ) : (
            <div className="empty-content">
              <p>请上传英文文本或粘贴内容开始阅读</p>
            </div>
          )}
        </div>
        
        {/* 侧边栏 */}
        <VocabularySidebar
          annotations={annotations}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onClearAll={clearAllAnnotations}
          onWordClick={scrollToWord}
        />
      </main>
      
      {/* 单词提示浮窗 */}
      {selectedWord && (
        <WordTooltip
          word={selectedWord.word}
          position={selectedWord.position}
          onAnnotateAll={annotateAll}
          onRemoveAnnotation={removeAnnotation}
          onClose={closeTooltip}
          isAnnotated={!!annotations[selectedWord.word.toLowerCase()]}
          annotation={annotations[selectedWord.word.toLowerCase()] || null}
        />
      )}
      
      {/* 加载指示器 */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <span>正在标注...</span>
        </div>
      )}
      
      <style jsx>{`
        .app-container {
          min-height: 100vh;
          background: #fff8f0;
        }
        
        .app-header {
          position: sticky;
          top: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 24px;
          background: white;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }
        
        .header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        
        .app-title {
          font-size: 20px;
          font-weight: 600;
          color: #333;
          margin: 0;
        }
        
        .header-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        
        .header-stats {
          display: flex;
          gap: 16px;
          font-size: 14px;
          color: #666;
        }
        
        .stat strong {
          color: #4a90d9;
        }
        
        .sidebar-toggle {
          background: none;
          border: 1px solid #ddd;
          padding: 8px;
          border-radius: 6px;
          cursor: pointer;
          color: #666;
          display: flex;
          align-items: center;
          transition: all 0.15s ease;
        }
        
        .sidebar-toggle:hover {
          background: #f5f5f5;
          color: #333;
        }
        
        .upload-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: #4a90d9;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }
        
        .upload-btn:hover {
          background: #3a7bc8;
        }
        
        .input-panel {
          background: white;
          padding: 24px;
          margin: 20px;
          border-radius: 12px;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
        }
        
        .input-section {
          margin-bottom: 16px;
        }
        
        .input-section h3 {
          font-size: 16px;
          font-weight: 600;
          color: #333;
          margin: 0 0 8px;
        }
        
        .input-hint {
          font-size: 12px;
          color: #888;
          margin: 0 0 12px;
        }
        
        .file-input {
          display: none;
        }
        
        .file-label {
          display: inline-block;
          padding: 10px 20px;
          background: #f5f5f5;
          border: 1px dashed #ccc;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          color: #666;
          transition: all 0.15s ease;
        }
        
        .file-label:hover {
          background: #eee;
          border-color: #4a90d9;
          color: #4a90d9;
        }
        
        .input-divider {
          text-align: center;
          color: #999;
          font-size: 14px;
          margin: 20px 0;
          position: relative;
        }
        
        .input-divider::before,
        .input-divider::after {
          content: "";
          position: absolute;
          top: 50%;
          width: 45%;
          height: 1px;
          background: #eee;
        }
        
        .input-divider::before {
          left: 0;
        }
        
        .input-divider::after {
          right: 0;
        }
        
        .text-input {
          width: 100%;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 14px;
          resize: vertical;
          font-family: inherit;
          margin-bottom: 12px;
          box-sizing: border-box;
        }
        
        .text-input:focus {
          outline: none;
          border-color: #4a90d9;
        }
        
        .start-btn {
          padding: 10px 24px;
          background: #4a90d9;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }
        
        .start-btn:hover:not(:disabled) {
          background: #3a7bc8;
        }
        
        .start-btn:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
        
        .main-content {
          display: flex;
          min-height: calc(100vh - 70px);
        }
        
        .reading-container {
          flex: 1;
          padding-bottom: 40px;
        }
        
        .empty-content {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 50vh;
          color: #888;
          font-size: 16px;
        }
        
        .loading-overlay {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(255, 255, 255, 0.95);
          padding: 24px 32px;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          z-index: 200;
        }
        
        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #e0e0e0;
          border-top-color: #4a90d9;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        
        @media (max-width: 768px) {
          .app-header {
            padding: 12px 16px;
          }
          
          .app-title {
            font-size: 16px;
          }
          
          .header-stats {
            display: none;
          }
          
          .input-panel {
            margin: 12px;
            padding: 16px;
          }
        }
      `}</style>
    </div>
  );
}
