"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import {
  Upload,
  Download,
  Check,
  AlertCircle,
  FolderDown,
  FolderUp,
  BookOpen,
} from "lucide-react";
import { idbGet, idbSet } from "@/lib/storage";

interface VocabItem {
  root: string;
  meaning: string;
  pos: string;
}

// 导出文件格式
interface VocabExportData {
  type: "vocabulary-export";
  version: 1;
  exportedAt: string;
  vocabulary: Record<string, VocabItem>;
  stats: {
    totalWords: number;
    fromGlobal: number;
    fromBooks: number;
    bookNames: string[];
  };
}

/** 兼容所有浏览器的文件下载 */
function downloadJSON(jsonStr: string, filename: string) {
  const dataUrl = "data:application/json;charset=utf-8," + encodeURIComponent(jsonStr);
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

interface DataBackupPanelProps {
  globalVocabulary?: Record<string, VocabItem>;
  onMergeGlobalVocabulary?: (incoming: Record<string, VocabItem>) => void;
  books?: Array<{
    id: string;
    title: string;
    annotations: Record<
      string,
      { root: string; meaning: string; pos: string; count: number }
    >;
  }>;
  backgroundColor?: string;
}

type ModalStatus = "idle" | "exporting" | "importing" | "success" | "error";
type MainTab = "backup" | "vocab";

export function DataBackupPanel({
  globalVocabulary = {},
  onMergeGlobalVocabulary,
  books = [],
  backgroundColor = "#ffffff",
}: DataBackupPanelProps) {
  const [mainTab, setMainTab] = useState<MainTab>("backup");
  const [activeTab, setActiveTab] = useState<"export" | "import">("export");
  const [vocabTab, setVocabTab] = useState<"export" | "import">("export");
  const [status, setStatus] = useState<ModalStatus>("idle");
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const vocabFileInputRef = useRef<HTMLInputElement>(null);

  const resetStatus = () => {
    setStatus("idle");
    setMessage("");
  };

  // =============================================
  //  原有的数据备份逻辑
  // =============================================

  const handleExport = async () => {
    setStatus("exporting");
    setMessage("正在导出数据...");
    try {
      const data: Record<string, unknown> = {};
      try {
        const booksStr = await idbGet("english-reader-books");
        if (booksStr) data.books = JSON.parse(booksStr);
      } catch (e) {
        console.warn("从 IndexedDB 读取书籍失败:", e);
      }
      const settingsStr = localStorage.getItem("english-reader-settings");
      if (settingsStr) {
        try { data.settings = JSON.parse(settingsStr); } catch {}
      }
      const sidebarStr = localStorage.getItem("reading-sidebar-states");
      if (sidebarStr) {
        try { data.sidebarStates = JSON.parse(sidebarStr); } catch {}
      }
      try {
        const vocabStr = await idbGet("english-reader-global-vocabulary");
        if (vocabStr) data.globalVocabulary = JSON.parse(vocabStr);
      } catch (e) {
        console.warn("从 IndexedDB 读取全局词汇表失败:", e);
      }
      data.exportedAt = new Date().toISOString();
      data.version = 1;

      const jsonStr = JSON.stringify(data, null, 2);
      const dateStr = new Date().toISOString().split("T")[0];
      downloadJSON(jsonStr, `reading-assistant-backup-${dateStr}.json`);

      const bookCount = Array.isArray(data.books) ? data.books.length : 0;
      const vocabCount = data.globalVocabulary ? Object.keys(data.globalVocabulary).length : 0;
      setStatus("success");
      setMessage(`导出成功！文件已下载（共 ${bookCount} 本书，${vocabCount} 个词汇）`);
    } catch (err) {
      setStatus("error");
      setMessage("导出失败: " + (err instanceof Error ? err.message : "未知错误"));
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("importing");
    setMessage("正在读取文件...");
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data.books)) throw new Error("文件格式无效：缺少 books 数组");
      const bookCount = data.books.length;
      const vocabCount = data.globalVocabulary ? Object.keys(data.globalVocabulary).length : 0;
      if (!window.confirm(`导入将覆盖当前设备上的所有数据，确定要继续吗？\n\n文件包含 ${bookCount} 本书，${vocabCount} 个词汇。`)) {
        setStatus("idle");
        setMessage("");
        return;
      }
      setMessage("正在导入数据...");
      if (data.books) await idbSet("english-reader-books", JSON.stringify(data.books));
      if (data.globalVocabulary) await idbSet("english-reader-global-vocabulary", JSON.stringify(data.globalVocabulary));
      if (data.settings) localStorage.setItem("english-reader-settings", JSON.stringify(data.settings));
      if (data.sidebarStates) localStorage.setItem("reading-sidebar-states", JSON.stringify(data.sidebarStates));
      setStatus("success");
      setMessage(`导入成功！共 ${bookCount} 本书，页面即将刷新...`);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setStatus("error");
      setMessage("导入失败: " + (err instanceof Error ? err.message : "未知错误"));
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // =============================================
  //  词汇表导出/导入
  // =============================================

  const handleVocabExport = async () => {
    setStatus("exporting");
    setMessage("正在打包词汇表...");
    try {
      const allVocab: Record<string, VocabItem> = { ...globalVocabulary };
      const fromGlobal = Object.keys(globalVocabulary).length;
      let fromBooks = 0;
      const bookNames: string[] = [];

      for (const book of books) {
        const bookAnnotations = book.annotations || {};
        const keys = Object.keys(bookAnnotations);
        if (keys.length === 0) continue;

        let bookNewCount = 0;
        for (const [root, ann] of Object.entries(bookAnnotations)) {
          if (!allVocab[root]) {
            allVocab[root] = {
              root: ann.root,
              meaning: ann.meaning,
              pos: ann.pos,
            };
            bookNewCount++;
          }
        }
        if (bookNewCount > 0) {
          fromBooks += bookNewCount;
          bookNames.push(book.title);
        }
      }

      const exportData: VocabExportData = {
        type: "vocabulary-export",
        version: 1,
        exportedAt: new Date().toISOString(),
        vocabulary: allVocab,
        stats: {
          totalWords: Object.keys(allVocab).length,
          fromGlobal,
          fromBooks,
          bookNames,
        },
      };

      const jsonStr = JSON.stringify(exportData, null, 2);
      const dateStr = new Date().toISOString().split("T")[0];
      downloadJSON(jsonStr, `vocabulary-export-${dateStr}.json`);

      setStatus("success");
      setMessage(
        `导出成功！共 ${Object.keys(allVocab).length} 个词汇` +
        (fromBooks > 0 ? `（含书本独有词汇 ${fromBooks} 个，来自${bookNames.length}本书）` : "")
      );
    } catch (err) {
      setStatus("error");
      setMessage("导出失败: " + (err instanceof Error ? err.message : "未知错误"));
    }
  };

  const handleVocabImportClick = () => vocabFileInputRef.current?.click();

  const handleVocabFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("importing");
    setMessage("正在读取词汇文件...");
    try {
      const text = await file.text();
      const data = JSON.parse(text) as VocabExportData;

      if (data.type !== "vocabulary-export" || !data.vocabulary) {
        throw new Error("文件格式无效：不是词汇表导出文件");
      }

      const incomingCount = Object.keys(data.vocabulary).length;

      let replaceCount = 0;
      let appendCount = 0;
      for (const root of Object.keys(data.vocabulary)) {
        if (globalVocabulary[root]) {
          replaceCount++;
        } else {
          appendCount++;
        }
      }

      const confirmMsg = [
        `即将合并 ${incomingCount} 个词汇到全局词汇表：`,
        ``,
        `  新增：${appendCount} 个`,
        `  更新：${replaceCount} 个（已有词汇，释义将被替换）`,
        `  现有词汇表不会丢失任何词`,
        ``,
        `确定要继续吗？`,
      ].join("\n");

      if (!window.confirm(confirmMsg)) {
        setStatus("idle");
        setMessage("");
        return;
      }

      setMessage("正在合并词汇...");

      if (onMergeGlobalVocabulary) {
        onMergeGlobalVocabulary(data.vocabulary);
      }

      setStatus("success");
      setMessage(`合并完成！新增 ${appendCount} 个，更新 ${replaceCount} 个，现有词汇未受影响`);
    } catch (err) {
      setStatus("error");
      setMessage("导入失败: " + (err instanceof Error ? err.message : "未知错误"));
    }
    if (vocabFileInputRef.current) vocabFileInputRef.current.value = "";
  };

  // 统计当前词汇情况
  const globalCount = Object.keys(globalVocabulary).length;
  const booksWithAnnotations = books.filter(
    (b) => Object.keys(b.annotations || {}).length > 0
  );

  return (
    <div className="data-backup-panel" style={{ backgroundColor }}>
      <style jsx>{`
        .data-backup-panel {
          min-height: 100%;
          padding: 16px;
        }

        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .panel-title {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: #333;
        }

        :global(.dark) .panel-title {
          color: #e0e0e0;
        }

        .main-tabs {
          display: flex;
          padding: 8px;
          gap: 8px;
          background: #f5f5f5;
          border-radius: 12px;
          margin-bottom: 16px;
        }

        :global(.dark) .main-tabs {
          background: #2a2a3e;
        }

        .main-tab-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px 16px;
          background: transparent;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          color: #666;
          transition: all 0.2s;
        }

        .main-tab-btn:hover {
          background: rgba(0, 0, 0, 0.05);
        }

        :global(.dark) .main-tab-btn {
          color: #888;
        }

        :global(.dark) .main-tab-btn:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .main-tab-btn.active {
          background: white;
          color: #4a90d9;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        :global(.dark) .main-tab-btn.active {
          background: #1e1e2e;
          color: #6ba3e0;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }

        .content-section {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        }

        :global(.dark) .content-section {
          background: #1e1e2e;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }

        .modal-tabs {
          display: flex;
          border-bottom: 1px solid #eee;
          margin: -20px -20px 20px;
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
          padding: 14px;
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

        .section-icon {
          color: #4a90d9;
          margin-bottom: 16px;
          display: flex;
          justify-content: center;
        }

        :global(.dark) .section-icon {
          color: #6ba3e0;
        }

        .section-desc {
          margin: 0 0 8px;
          font-size: 14px;
          color: #333;
          text-align: center;
        }

        :global(.dark) .section-desc {
          color: #ccc;
        }

        .section-note {
          margin: 0 0 20px;
          font-size: 12px;
          color: #888;
          text-align: center;
        }

        .section-note.warning {
          color: #e74c3c;
          font-weight: 500;
        }

        .section-note.safe {
          color: #27ae60;
          font-weight: 500;
        }

        .action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 14px;
          font-size: 15px;
        }

        .status-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: #666;
          font-size: 14px;
          padding: 14px;
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
      `}</style>

      {/* 页面标题 */}
      <div className="panel-header">
        <h2 className="panel-title">数据管理</h2>
      </div>

      {/* 顶级 Tab */}
      <div className="main-tabs">
        <button
          className={`main-tab-btn ${mainTab === "backup" ? "active" : ""}`}
          onClick={() => { setMainTab("backup"); resetStatus(); }}
        >
          <FolderDown size={16} />
          数据备份
        </button>
        <button
          className={`main-tab-btn ${mainTab === "vocab" ? "active" : ""}`}
          onClick={() => { setMainTab("vocab"); resetStatus(); }}
        >
          <BookOpen size={16} />
          词汇表
        </button>
      </div>

      {/* 内容区域 */}
      <div className="content-section">
        {/* ====== 数据备份 ====== */}
        {mainTab === "backup" && (
          <>
            <div className="modal-tabs">
              <button
                className={`tab-btn ${activeTab === "export" ? "active" : ""}`}
                onClick={() => { setActiveTab("export"); resetStatus(); }}
              >
                <Download size={18} />
                导出数据
              </button>
              <button
                className={`tab-btn ${activeTab === "import" ? "active" : ""}`}
                onClick={() => { setActiveTab("import"); resetStatus(); }}
              >
                <Upload size={18} />
                导入数据
              </button>
            </div>
            {activeTab === "export" ? (
              <div className="export-section">
                <div className="section-icon"><FolderDown size={48} /></div>
                <p className="section-desc">导出所有书籍、标注、书签和阅读设置到本地文件。</p>
                <p className="section-note">导出的文件可以在其他设备上导入使用。</p>
                {status === "exporting" ? (
                  <div className="status-loading"><Spinner /><span>{message}</span></div>
                ) : status === "success" ? (
                  <Alert variant="default" className="success-alert"><Check size={16} /><AlertDescription>{message}</AlertDescription></Alert>
                ) : status === "error" ? (
                  <Alert variant="destructive"><AlertCircle size={16} /><AlertDescription>{message}</AlertDescription></Alert>
                ) : (
                  <Button onClick={handleExport} className="action-btn"><Download size={18} />导出全部数据</Button>
                )}
              </div>
            ) : (
              <div className="import-section">
                <div className="section-icon"><FolderUp size={48} /></div>
                <p className="section-desc">从之前导出的备份文件导入数据。</p>
                <p className="section-note warning">警告：导入会覆盖当前所有数据！</p>
                <input ref={fileInputRef} type="file" accept=".json" style={{ display: "none" }} onChange={handleFileSelect} />
                {status === "importing" ? (
                  <div className="status-loading"><Spinner /><span>{message}</span></div>
                ) : status === "success" ? (
                  <Alert variant="default" className="success-alert"><Check size={16} /><AlertDescription>{message}</AlertDescription></Alert>
                ) : status === "error" ? (
                  <Alert variant="destructive"><AlertCircle size={16} /><AlertDescription>{message}</AlertDescription></Alert>
                ) : (
                  <Button onClick={handleImportClick} variant="outline" className="action-btn"><Upload size={18} />选择备份文件</Button>
                )}
              </div>
            )}
          </>
        )}

        {/* ====== 词汇表 ====== */}
        {mainTab === "vocab" && (
          <>
            <div className="modal-tabs">
              <button
                className={`tab-btn ${vocabTab === "export" ? "active" : ""}`}
                onClick={() => { setVocabTab("export"); resetStatus(); }}
              >
                <Download size={18} />
                导出词汇
              </button>
              <button
                className={`tab-btn ${vocabTab === "import" ? "active" : ""}`}
                onClick={() => { setVocabTab("import"); resetStatus(); }}
              >
                <Upload size={18} />
                导入词汇
              </button>
            </div>
            {vocabTab === "export" ? (
              <div className="export-section">
                <div className="section-icon"><BookOpen size={48} /></div>
                <p className="section-desc">导出全局词汇和书本标注词汇，打包下载。</p>
                <p className="section-note">
                  全局词汇 {globalCount} 个
                  {booksWithAnnotations.length > 0 &&
                    `，${booksWithAnnotations.length} 本书有标注`}
                </p>
                {status === "exporting" ? (
                  <div className="status-loading"><Spinner /><span>{message}</span></div>
                ) : status === "success" ? (
                  <Alert variant="default" className="success-alert"><Check size={16} /><AlertDescription>{message}</AlertDescription></Alert>
                ) : status === "error" ? (
                  <Alert variant="destructive"><AlertCircle size={16} /><AlertDescription>{message}</AlertDescription></Alert>
                ) : (
                  <Button onClick={handleVocabExport} className="action-btn"><Download size={18} />导出词汇表</Button>
                )}
              </div>
            ) : (
              <div className="import-section">
                <div className="section-icon"><BookOpen size={48} /></div>
                <p className="section-desc">从词汇文件导入到全局词汇表。</p>
                <p className="section-note safe">安全合并：重复词更新释义，新词追加，不会丢失任何现有词汇。</p>
                <input ref={vocabFileInputRef} type="file" accept=".json" style={{ display: "none" }} onChange={handleVocabFileSelect} />
                {status === "importing" ? (
                  <div className="status-loading"><Spinner /><span>{message}</span></div>
                ) : status === "success" ? (
                  <Alert variant="default" className="success-alert"><Check size={16} /><AlertDescription>{message}</AlertDescription></Alert>
                ) : status === "error" ? (
                  <Alert variant="destructive"><AlertCircle size={16} /><AlertDescription>{message}</AlertDescription></Alert>
                ) : (
                  <Button onClick={handleVocabImportClick} variant="outline" className="action-btn"><Upload size={18} />选择词汇文件</Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
