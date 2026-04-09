"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Upload, Download, Check, AlertCircle, X, FolderDown, FolderUp } from "lucide-react";
import { idbGet, idbSet } from "@/lib/storage";

interface ExportImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ModalStatus = "idle" | "exporting" | "importing" | "success" | "error";

export function ExportImportModal({ open, onOpenChange }: ExportImportModalProps) {
  const [activeTab, setActiveTab] = useState<"export" | "import">("export");
  const [status, setStatus] = useState<ModalStatus>("idle");
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 导出数据
  const handleExport = async () => {
    setStatus("exporting");
    setMessage("正在导出数据...");

    try {
      const data: Record<string, unknown> = {};

      // 从 IndexedDB 读取书籍数据
      try {
        const booksStr = await idbGet("english-reader-books");
        if (booksStr) {
          data.books = JSON.parse(booksStr);
        }
      } catch (e) {
        console.warn("从 IndexedDB 读取书籍失败:", e);
      }

      // 从 localStorage 读取设置
      const settingsStr = localStorage.getItem("english-reader-settings");
      if (settingsStr) {
        try {
          data.settings = JSON.parse(settingsStr);
        } catch {}
      }

      // 从 localStorage 读取侧边栏状态
      const sidebarStr = localStorage.getItem("reading-sidebar-states");
      if (sidebarStr) {
        try {
          data.sidebarStates = JSON.parse(sidebarStr);
        } catch {}
      }

      // 添加导出时间戳
      data.exportedAt = new Date().toISOString();
      data.version = 1;

      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      // 生成文件名：reading-assistant-backup-YYYY-MM-DD.json
      const now = new Date();
      const dateStr = now.toISOString().split("T")[0];
      const fileName = `reading-assistant-backup-${dateStr}.json`;

      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const bookCount = Array.isArray(data.books) ? data.books.length : 0;
      setStatus("success");
      setMessage(`导出成功！文件已下载（共 ${bookCount} 本书）`);
    } catch (err) {
      setStatus("error");
      setMessage("导出失败: " + (err instanceof Error ? err.message : "未知错误"));
    }
  };

  // 触发文件选择
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  // 读取并导入文件
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("importing");
    setMessage("正在读取文件...");

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // 验证格式
      if (!Array.isArray(data.books)) {
        throw new Error("文件格式无效：缺少 books 数组");
      }

      const bookCount = data.books.length;

      // 确认导入
      if (!window.confirm(`导入将覆盖当前设备上的所有数据，确定要继续吗？\n\n文件包含 ${bookCount} 本书。`)) {
        setStatus("idle");
        setMessage("");
        return;
      }

      setMessage("正在导入数据...");

      // 写入 IndexedDB
      if (data.books) {
        await idbSet("english-reader-books", JSON.stringify(data.books));
      }

      // 写入 localStorage
      if (data.settings) {
        localStorage.setItem("english-reader-settings", JSON.stringify(data.settings));
      }
      if (data.sidebarStates) {
        localStorage.setItem("reading-sidebar-states", JSON.stringify(data.sidebarStates));
      }

      setStatus("success");
      setMessage(`导入成功！共 ${bookCount} 本书，页面即将刷新...`);

      // 延迟刷新
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      setStatus("error");
      setMessage("导入失败: " + (err instanceof Error ? err.message : "未知错误"));
    }

    // 清空文件输入，以便重复选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  if (!open) return null;

  return (
    <div className="export-import-modal-overlay" onClick={() => onOpenChange(false)}>
      <div className="export-import-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2>数据备份</h2>
          <button className="close-btn" onClick={() => onOpenChange(false)}>
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="modal-tabs">
          <button
            className={`tab-btn ${activeTab === "export" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("export");
              setStatus("idle");
              setMessage("");
            }}
          >
            <Download size={18} />
            导出数据
          </button>
          <button
            className={`tab-btn ${activeTab === "import" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("import");
              setStatus("idle");
              setMessage("");
            }}
          >
            <Upload size={18} />
            导入数据
          </button>
        </div>

        {/* Content */}
        <div className="modal-content">
          {activeTab === "export" ? (
            <div className="export-section">
              <div className="section-icon">
                <FolderDown size={48} />
              </div>
              <p className="section-desc">
                导出所有书籍、标注、书签和阅读设置到本地文件。
              </p>
              <p className="section-note">
                导出的文件可以在其他设备上导入使用。
              </p>

              {status === "exporting" ? (
                <div className="status-loading">
                  <Spinner />
                  <span>{message}</span>
                </div>
              ) : status === "success" ? (
                <Alert variant="default" className="success-alert">
                  <Check size={16} />
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              ) : status === "error" ? (
                <Alert variant="destructive">
                  <AlertCircle size={16} />
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              ) : (
                <Button onClick={handleExport} className="action-btn">
                  <Download size={18} />
                  导出全部数据
                </Button>
              )}
            </div>
          ) : (
            <div className="import-section">
              <div className="section-icon">
                <FolderUp size={48} />
              </div>
              <p className="section-desc">
                从之前导出的备份文件导入数据。
              </p>
              <p className="section-note warning">
                警告：导入会覆盖当前所有数据！
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: "none" }}
                onChange={handleFileSelect}
              />

              {status === "importing" ? (
                <div className="status-loading">
                  <Spinner />
                  <span>{message}</span>
                </div>
              ) : status === "success" ? (
                <Alert variant="default" className="success-alert">
                  <Check size={16} />
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              ) : status === "error" ? (
                <Alert variant="destructive">
                  <AlertCircle size={16} />
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              ) : (
                <Button onClick={handleImportClick} variant="outline" className="action-btn">
                  <Upload size={18} />
                  选择备份文件
                </Button>
              )}
            </div>
          )}
        </div>

        <style jsx>{`
          .export-import-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
          }

          .export-import-modal {
            background: white;
            border-radius: 12px;
            width: 90%;
            max-width: 400px;
            max-height: 90vh;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          }

          :global(.dark) .export-import-modal {
            background: #1e1e2e;
            color: #e0e0e0;
          }

          .modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            border-bottom: 1px solid #eee;
          }

          :global(.dark) .modal-header {
            border-bottom-color: #333;
          }

          .modal-header h2 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
          }

          .close-btn {
            background: none;
            border: none;
            cursor: pointer;
            padding: 4px;
            color: #666;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
          }

          .close-btn:hover {
            background: #f0f0f0;
          }

          :global(.dark) .close-btn {
            color: #888;
          }

          :global(.dark) .close-btn:hover {
            background: #333;
          }

          .modal-tabs {
            display: flex;
            border-bottom: 1px solid #eee;
          }

          :global(.dark) .modal-tabs {
            border-bottom-color: #333;
          }

          .tab-btn {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 12px;
            background: none;
            border: none;
            cursor: pointer;
            font-size: 14px;
            color: #666;
            border-bottom: 2px solid transparent;
            transition: all 0.2s;
          }

          .tab-btn:hover {
            background: #f5f5f5;
          }

          :global(.dark) .tab-btn {
            color: #888;
          }

          :global(.dark) .tab-btn:hover {
            background: #2a2a3e;
          }

          .tab-btn.active {
            color: #4a90d9;
            border-bottom-color: #4a90d9;
          }

          :global(.dark) .tab-btn.active {
            color: #6ba3e0;
            border-bottom-color: #6ba3e0;
          }

          .modal-content {
            padding: 24px 20px;
          }

          .export-section,
          .import-section {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
          }

          .section-icon {
            color: #4a90d9;
            margin-bottom: 16px;
          }

          :global(.dark) .section-icon {
            color: #6ba3e0;
          }

          .section-desc {
            margin: 0 0 8px 0;
            font-size: 14px;
            color: #333;
          }

          :global(.dark) .section-desc {
            color: #ccc;
          }

          .section-note {
            margin: 0 0 20px 0;
            font-size: 12px;
            color: #888;
          }

          .section-note.warning {
            color: #e74c3c;
            font-weight: 500;
          }

          .action-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            width: 100%;
            padding: 12px;
            font-size: 14px;
          }

          .status-loading {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #666;
            font-size: 14px;
          }

          :global(.dark) .status-loading {
            color: #888;
          }

          :global(.success-alert) {
            display: flex;
            align-items: center;
            gap: 8px;
            background: #d4edda;
            border-color: #c3e6cb;
            color: #155724;
          }

          :global(.dark) .success-alert {
            background: #1e3a2f;
            border-color: #2d5a47;
            color: #8fbc8f;
          }

          :global(.dark) .alert) :global(.destructive) {
            background: #3d1e1e;
            border-color: #5d2e2e;
            color: #f5a5a5;
          }
        `}</style>
      </div>
    </div>
  );
}
