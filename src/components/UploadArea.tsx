"use client";

import React, { useState, useCallback, useRef } from "react";

interface UploadAreaProps {
  onFileUpload: (file: File) => void;
  onTextSubmit: (text: string) => void;
}

export function UploadArea({ onFileUpload, onTextSubmit }: UploadAreaProps) {
  const [inputText, setInputText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && file.type === "text/plain") {
        onFileUpload(file);
      }
    },
    [onFileUpload]
  );
  
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      
      const file = e.dataTransfer.files?.[0];
      if (file && file.type === "text/plain") {
        onFileUpload(file);
      }
    },
    [onFileUpload]
  );
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);
  
  const handleSubmit = useCallback(() => {
    if (inputText.trim()) {
      onTextSubmit(inputText.trim());
    }
  }, [inputText, onTextSubmit]);
  
  return (
    <div className="upload-area">
      <div
        className={`drop-zone ${isDragging ? "dragging" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
        <div className="drop-zone-content">
          <div className="upload-icon">📄</div>
          <p className="upload-title">上传英文文本文件</p>
          <p className="upload-hint">支持 .txt 格式，UTF-8 编码</p>
        </div>
      </div>
      
      <div className="divider">
        <span>或者</span>
      </div>
      
      <div className="text-input-area">
        <textarea
          className="text-input"
          placeholder="直接粘贴英文文本..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
        />
        <button
          className="submit-btn"
          onClick={handleSubmit}
          disabled={!inputText.trim()}
        >
          开始阅读
        </button>
      </div>
      
      <style jsx>{`
        .upload-area {
          max-width: 600px;
          margin: 0 auto;
          padding: 2rem;
        }
        
        .drop-zone {
          border: 2px dashed #ddd;
          border-radius: 12px;
          padding: 3rem 2rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
          background: #fafafa;
        }
        
        .drop-zone:hover {
          border-color: #4a90d9;
          background: #f0f7ff;
        }
        
        .drop-zone.dragging {
          border-color: #4a90d9;
          background: #e8f4fd;
          transform: scale(1.02);
        }
        
        .drop-zone-content {
          pointer-events: none;
        }
        
        .upload-icon {
          font-size: 48px;
          margin-bottom: 1rem;
        }
        
        .upload-title {
          font-size: 16px;
          font-weight: 500;
          color: #333;
          margin: 0 0 8px 0;
        }
        
        .upload-hint {
          font-size: 13px;
          color: #999;
          margin: 0;
        }
        
        .divider {
          display: flex;
          align-items: center;
          margin: 2rem 0;
        }
        
        .divider::before,
        .divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: #eee;
        }
        
        .divider span {
          padding: 0 1rem;
          color: #999;
          font-size: 13px;
        }
        
        .text-input-area {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .text-input {
          width: 100%;
          min-height: 150px;
          padding: 16px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-family: Georgia, serif;
          font-size: 14px;
          line-height: 1.6;
          resize: vertical;
          transition: border-color 0.2s ease;
        }
        
        .text-input:focus {
          outline: none;
          border-color: #4a90d9;
        }
        
        .submit-btn {
          padding: 12px 24px;
          background: #4a90d9;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s ease;
        }
        
        .submit-btn:hover:not(:disabled) {
          background: #3a7bc8;
        }
        
        .submit-btn:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
