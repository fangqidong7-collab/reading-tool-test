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
  X,
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
  // 所有词汇打平在这里，不区分来源
  vocabulary: Record<string, VocabItem>;
  stats: {
    totalWords: number;
    fromGlobal: number;
    fromBooks: number;
    bookNames: string[];
  };
}

interface ExportImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
}

type ModalStatus = "idle" | "exporting" | "importing" | "success" | "error";
type MainTab = "backup" | "vocab";

export function ExportImportModal({
  open,
  onOpenChange,
  globalVocabulary = {},
  onMergeGlobalVocabulary,
  books = [],
}: ExportImportModalProps) {
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
  //  原有的数据备份逻辑（完全不动）
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
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const dateStr = new Date().toISOString().split("T")[0];
      const a = document.createElement("a");
      a.href = url;
      a.download = `reading-assistant-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

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
  //  新增：词汇表导出/导入
  // =============================================

  const handleVocabExport = async () => {
    setStatus("exporting");
    setMessage("正在打包词汇表...");
    try {
      // 先把全局词汇全部放入
      const allVocab: Record<string, VocabItem> = { ...globalVocabulary };
      let fromGlobal = Object.keys(globalVocabulary).length;
      let fromBooks = 0;
      const bookNames: string[] = [];

      // 再把每本书里的标注词汇合并进来
      // 书本中已存在于全局的词会被全局的覆盖（因为全局先放的），
      // 但书本中有而全局没有的会被追加进去
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
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const dateStr = new Date().toISOString().split("T")[0];
      const a = document.createElement("a");
      a.href = url;
      a.download = `vocabulary-export-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

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

      // 预计算合并结果
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

  // =============================================

  if (!open) return null;

  // 统计当前词汇情况
  const globalCount = Object.keys(globalVocabulary).length;
  const booksWithAnnotations = books.filter(
    (b) => Object.keys(b.annotations || {}).length > 0
  );

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 20,
      }}
      onClick={() => onOpenChange(false)}
    >
      <div
        style={{
          background: "white",
          borderRadius: 12,
          width: "90%",
          maxWidth: 420,
          maxHeight: "90vh",
          overflow: "hidden",
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <h2>数据管理</h2>
          <button className="close-btn" onClick={() => onOpenChange(false)}>
            <X size={20} />
          </button>
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
            <div className="modal-content">
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
            </div>
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
            <div className="modal-content">
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
            </div>
          </>
        )}

        <style jsx>{`
          .modal-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 16px 20px; border-bottom: 1px solid #eee;
          }
          :global(.dark) .modal-header { border-bottom-color: #333; }
          .modal-header h2 { margin: 0; font-size: 18px; font-weight: 600; }
          .close-btn {
            background: none; border: none; cursor: pointer; padding: 4px;
            color: #666; display: flex; align-items: center; justify-content: center; border-radius: 4px;
          }
          .close-btn:hover { background: #f0f0f0; }
          :global(.dark) .close-btn { color: #888; }
          :global(.dark) .close-btn:hover { background: #333; }

          .main-tabs { display: flex; padding: 8px 16px 0; gap: 8px; }
          .main-tab-btn {
            flex: 1; display: flex; align-items: center; justify-content: center;
            gap: 6px; padding: 8px 12px;
            background: #f5f5f5; border: 1px solid #e0e0e0;
            border-radius: 8px 8px 0 0; cursor: pointer;
            font-size: 13px; font-weight: 500; color: #666; transition: all 0.2s;
          }
          .main-tab-btn:hover { background: #eee; }
          .main-tab-btn.active {
            background: white; color: #4a90d9;
            border-bottom-color: white; font-weight: 600;
          }
          :global(.dark) .main-tab-btn { background: #2a2a3e; border-color: #333; color: #888; }
          :global(.dark) .main-tab-btn.active { background: #1e1e2e; color: #6ba3e0; border-bottom-color: #1e1e2e; }

          .modal-tabs { display: flex; border-bottom: 1px solid #eee; }
          :global(.dark) .modal-tabs { border-bottom-color: #333; }
          .tab-btn {
            flex: 1; display: flex; align-items: center; justify-content: center;
            gap: 8px; padding: 12px; background: none; border: none;
            cursor: pointer; font-size: 14px; color: #666;
            border-bottom: 2px solid transparent; transition: all 0.2s;
          }
          .tab-btn:hover { background: #f5f5f5; }
          :global(.dark) .tab-btn { color: #888; }
          :global(.dark) .tab-btn:hover { background: #2a2a3e; }
          .tab-btn.active { color: #4a90d9; border-bottom-color: #4a90d9; }
          :global(.dark) .tab-btn.active { color: #6ba3e0; border-bottom-color: #6ba3e0; }

          .modal-content { padding: 24px 20px; }
          .export-section, .import-section {
            display: flex; flex-direction: column; align-items: center; text-align: center;
          }
          .section-icon { color: #4a90d9; margin-bottom: 16px; }
          :global(.dark) .section-icon { color: #6ba3e0; }
          .section-desc { margin: 0 0 8px; font-size: 14px; color: #333; }
          :global(.dark) .section-desc { color: #ccc; }
          .section-note { margin: 0 0 20px; font-size: 12px; color: #888; }
          .section-note.warning { color: #e74c3c; font-weight: 500; }
          .section-note.safe { color: #27ae60; font-weight: 500; }
          .action-btn {
            display: flex; align-items: center; gap: 8px;
            width: 100%; padding: 12px; font-size: 14px;
          }
          .status-loading {
            display: flex; align-items: center; gap: 8px; color: #666; font-size: 14px;
          }
          :global(.dark) .status-loading { color: #888; }
          :global(.success-alert) {
            display: flex; align-items: center; gap: 8px;
            background: #d4edda; border-color: #c3e6cb; color: #155724;
          }
          :global(.dark) .success-alert { background: #1e3a2f; border-color: #2d5a47; color: #8fbc8f; }
        `}</style>
      </div>
    </div>
  );
}
