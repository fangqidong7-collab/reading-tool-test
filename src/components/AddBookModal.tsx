"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { parseFile, ParseProgress } from "@/lib/fileParser";

interface AddBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (title: string, content: string) => void;
}

export function AddBookModal({ isOpen, onClose, onAdd }: AddBookModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mode, setMode] = useState<"upload" | "paste">("paste");
  const [fileName, setFileName] = useState<string>("");
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState<ParseProgress>({
    stage: "idle",
    percent: 0,
    message: "",
  });
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && textareaRef.current && !parsing) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen, parsing]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !parsing) onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose, parsing]);

  const resetForm = useCallback(() => {
    setTitle("");
    setContent("");
    setFileName("");
    setParsing(false);
    setProgress({ stage: "idle", percent: 0, message: "" });
    setError(null);
    setMode("paste");
  }, []);

  const handleClose = useCallback(() => {
    if (!parsing) {
      resetForm();
      onClose();
    }
  }, [parsing, resetForm, onClose]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setFileName(file.name);
      setError(null);
      setParsing(true);

      // Extract filename without extension as default title
      const defaultTitle = file.name.replace(/\.[^/.]+$/, "");

      const result = await parseFile(file, setProgress);

      setParsing(false);

      if (result.success) {
        // Use parsed title if available, otherwise use filename
        const finalTitle = result.title || defaultTitle;
        setTitle(finalTitle);
        setContent(result.content);
        setMode("paste"); // Switch to paste mode to show preview
        
        // Move cursor to end of title input
        setTimeout(() => {
          if (titleInputRef.current) {
            titleInputRef.current.focus();
            titleInputRef.current.setSelectionRange(finalTitle.length, finalTitle.length);
          }
        }, 50);
      } else {
        setError(result.error || "解析失败");
        setFileName("");
      }
    },
    []
  );

  const handleSubmit = useCallback(() => {
    if (!content.trim()) return;
    onAdd(title.trim() || "未命名书籍", content);
    resetForm();
    onClose();
  }, [content, title, onAdd, resetForm, onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !parsing) {
      handleClose();
    }
  };

  const handleReset = () => {
    setError(null);
    setFileName("");
    setContent("");
    setTitle("");
    setProgress({ stage: "idle", percent: 0, message: "" });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  if (!isOpen) return null;

  const isComplete = progress.stage === "complete";

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>添加新书</h2>
          <button className="modal-close" onClick={handleClose} disabled={parsing}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Progress View */}
          {parsing && (
            <div className="parsing-progress">
              <div className="progress-icon">
                {isComplete ? (
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                ) : (
                  <div className="spinner"></div>
                )}
              </div>
              <div className="progress-message">{progress.message}</div>
              <div className="progress-bar-container">
                <div
                  className={`progress-bar ${isComplete ? "complete" : ""}`}
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <div className="progress-percent">{progress.percent}%</div>
            </div>
          )}

          {/* Error View */}
          {error && !parsing && (
            <div className="error-view">
              <div className="error-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div className="error-message">{error}</div>
              <button className="btn btn-secondary" onClick={handleReset}>
                重新选择文件
              </button>
            </div>
          )}

          {/* Normal Form */}
          {!parsing && !error && (
            <>
              <div className="form-group">
                <label htmlFor="book-title">书名</label>
                <input
                  ref={titleInputRef}
                  id="book-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="输入书名（可选，将使用文件名）"
                  className="form-input"
                  disabled={parsing}
                />
              </div>

              <div className="mode-tabs">
                <button
                  className={`mode-tab ${mode === "paste" ? "active" : ""}`}
                  onClick={() => setMode("paste")}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                  </svg>
                  粘贴文本
                </button>
                <button
                  className={`mode-tab ${mode === "upload" ? "active" : ""}`}
                  onClick={() => setMode("upload")}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  上传文件
                </button>
              </div>

              {mode === "paste" ? (
                <div className="form-group flex-1">
                  <label>英文文本</label>
                  <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="在此粘贴英文文本..."
                    className="form-textarea"
                    disabled={parsing}
                  />
                </div>
              ) : (
                <div className="form-group">
                  <p className="input-hint">支持 TXT、EPUB 格式</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.epub"
                    onChange={handleFileChange}
                    className="file-input"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="file-label">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span>
                      {fileName ? "已选择文件" : "选择文件"}
                    </span>
                  </label>
                  {content && (
                    <div className="file-preview">
                      <span className="file-name">{fileName}</span>
                      <span className="file-size">
                        {Math.round(content.length / 1024)} KB
                      </span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {!parsing && !error && (
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={handleClose}>
              取消
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={!content.trim()}
            >
              开始阅读
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .parsing-progress {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 40px 20px;
        }

        .progress-icon {
          margin-bottom: 24px;
        }

        .spinner {
          width: 48px;
          height: 48px;
          border: 3px solid #e8e8e8;
          border-top-color: #4a90d9;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .progress-message {
          font-size: 16px;
          color: #333;
          margin-bottom: 16px;
          font-weight: 500;
        }

        .progress-bar-container {
          width: 100%;
          max-width: 400px;
          height: 8px;
          background: #e8e8e8;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 12px;
        }

        .progress-bar {
          height: 100%;
          background: #4a90d9;
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .progress-bar.complete {
          background: #4caf50;
        }

        .progress-percent {
          font-size: 14px;
          color: #888;
        }

        .error-view {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 40px 20px;
          gap: 16px;
        }

        .error-message {
          font-size: 14px;
          color: #666;
          text-align: center;
          line-height: 1.6;
          max-width: 300px;
        }

        .error-icon {
          margin-bottom: 8px;
        }
      `}</style>
    </div>
  );
}
