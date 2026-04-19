"use client";

import { Bookshelf } from "@/components/Bookshelf";
import { GlobalVocabularyPage } from "@/components/GlobalVocabularyPage";
import { VocabularyQuiz } from "@/components/VocabularyQuiz";
import { ExportImportModal } from "@/components/ExportImportModal";
import { SyncPanel } from "@/components/SyncPanel";
import { DataBackupPanel } from "@/components/DataBackupPanel";
import type { Book, TocEntry } from "@/hooks/useBookshelf";

export interface BookshelfHomeViewProps {
  // Tab state
  activeTab: string;
  setActiveTab: (tab: "bookshelf" | "vocabulary" | "backup") => void;
  // Data manage modal
  dataManageOpen: boolean;
  setDataManageOpen: (open: boolean) => void;
  // Sync panel
  syncPanelOpen: boolean;
  setSyncPanelOpen: (open: boolean) => void;
  setSyncJustCreated: (v: boolean) => void;
  syncCode: string | null;
  syncing: boolean;
  lastSyncAt: number | null;
  syncError: string | null;
  syncJustCreated: boolean;
  handleCreateSync: () => Promise<void>;
  handleBindSync: (code: string) => Promise<void>;
  handleSync: () => Promise<void>;
  unbind: () => void;
  // Import tip
  showImportSyncTip: boolean;
  setShowImportSyncTip: (show: boolean) => void;
  // Quiz
  showQuiz: boolean;
  setShowQuiz: (show: boolean) => void;
  // Theme
  backgroundColor: string;
  isDarkMode: boolean;
  // Bookshelf data
  books: Book[];
  getProgress: (book: Book) => number;
  formatLastRead: (timestamp: number) => string;
  addBook: (title: string, content: string, tableOfContents?: TocEntry[]) => Book;
  deleteBook: (id: string) => void;
  openBook: (id: string) => void;
  // Vocabulary
  globalVocabulary: Record<string, { root: string; meaning: string; pos: string; correctCount: number }>;
  removeFromGlobalVocabulary: (word: string) => void;
  clearGlobalVocabulary: () => void;
  clearMasteredWords: (threshold: number) => void;
  mergeGlobalVocabulary: (vocab: Record<string, { root: string; meaning: string; pos: string }>) => void;
  incrementCorrectCount: (word: string) => void;
}

export function BookshelfHomeView({
  activeTab,
  setActiveTab,
  dataManageOpen,
  setDataManageOpen,
  syncPanelOpen,
  setSyncPanelOpen,
  setSyncJustCreated,
  syncCode,
  syncing,
  lastSyncAt,
  syncError,
  syncJustCreated,
  showImportSyncTip,
  setShowImportSyncTip,
  showQuiz,
  setShowQuiz,
  backgroundColor,
  isDarkMode,
  books,
  getProgress,
  formatLastRead,
  addBook,
  deleteBook,
  openBook,
  globalVocabulary,
  removeFromGlobalVocabulary,
  clearGlobalVocabulary,
  clearMasteredWords,
  mergeGlobalVocabulary,
  incrementCorrectCount,
  handleCreateSync,
  handleBindSync,
  handleSync,
  unbind,
}: BookshelfHomeViewProps) {
  return (
    <>
      <div className="bookshelf-page" style={{ backgroundColor }}>
        {/* 主内容区域 */}
        {activeTab === "bookshelf" ? (
          <Bookshelf
            books={books}
            getProgress={getProgress}
            formatLastRead={formatLastRead}
            onAddBook={addBook}
            onDeleteBook={deleteBook}
            onOpenBook={openBook}
            onSyncClick={() => setSyncPanelOpen(true)}
            onAddSuccess={() => {
              if (syncCode) {
                setShowImportSyncTip(true);
                setTimeout(() => setShowImportSyncTip(false), 5000);
              }
            }}
          />
        ) : activeTab === "vocabulary" ? (
          <GlobalVocabularyPage
            vocabulary={globalVocabulary}
            onRemoveWord={removeFromGlobalVocabulary}
            onClearAll={clearGlobalVocabulary}
            onClearMastered={clearMasteredWords}
            onStartQuiz={() => setShowQuiz(true)}
            backgroundColor={backgroundColor}
          />
        ) : (
          <DataBackupPanel
            globalVocabulary={globalVocabulary}
            onMergeGlobalVocabulary={mergeGlobalVocabulary}
            books={books}
            backgroundColor={backgroundColor}
          />
        )}

        {/* 书籍导入成功后显示同步提示 */}
        {showImportSyncTip && (
          <div className="import-sync-tip">
            请先在本机点「立即同步」，再在其它设备输入同步码。
          </div>
        )}

        {/* 底部工具栏 */}
        <div className="bottom-tab-bar">
          <button
            className={`tab-bar-item ${activeTab === "bookshelf" ? "active" : ""}`}
            onClick={() => setActiveTab("bookshelf")}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <span>书架</span>
          </button>
          <button
            className={`tab-bar-item ${activeTab === "vocabulary" ? "active" : ""}`}
            onClick={() => setActiveTab("vocabulary")}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            <span>词汇表</span>
            {Object.keys(globalVocabulary).length > 0 && (
              <span className="tab-bar-badge">{Object.keys(globalVocabulary).length}</span>
            )}
          </button>
          <button
            className={`tab-bar-item ${activeTab === "backup" ? "active" : ""}`}
            onClick={() => setActiveTab("backup")}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>数据备份</span>
          </button>
        </div>

        <style jsx>{`
          .bookshelf-page {
            min-height: 100vh;
            min-height: 100dvh;
            padding-bottom: 70px;
          }

          .import-sync-tip {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            padding: 12px 16px;
            background: linear-gradient(135deg, #fff3cd 0%, #ffeeba 100%);
            border-bottom: 1px solid #ffc107;
            color: #856404;
            font-size: 13px;
            text-align: center;
            z-index: 100;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          }
          :global(.dark) .import-sync-tip {
            background: linear-gradient(135deg, #3d3520 0%, #4a3d20 100%);
            color: #f0d58c;
            border-bottom-color: #8b7800;
          }

          .bottom-tab-bar {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 60px;
            background: white;
            border-top: 1px solid #e8e8e8;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0;
            z-index: 500;
            padding-bottom: env(safe-area-inset-bottom, 0);
            box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
          }

          .tab-bar-item {
            flex: 1;
            max-width: 160px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 3px;
            padding: 8px 0;
            background: none;
            border: none;
            cursor: pointer;
            color: #999;
            font-size: 11px;
            font-weight: 500;
            transition: color 0.15s ease;
            position: relative;
          }

          .tab-bar-item:hover {
            color: #666;
          }

          .tab-bar-item.active {
            color: #4a90d9;
          }

          .tab-bar-item.active svg {
            stroke: #4a90d9;
          }

          .tab-bar-badge {
            position: absolute;
            top: 4px;
            right: calc(50% - 26px);
            background: #e74c3c;
            color: white;
            font-size: 10px;
            font-weight: 600;
            min-width: 18px;
            height: 18px;
            border-radius: 9px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0 5px;
          }
        `}</style>
      </div>

      {/* Modal 放在 bookshelf-page 外面，直接挂在 React 根节点下 */}
      <ExportImportModal
        open={dataManageOpen}
        onOpenChange={setDataManageOpen}
        globalVocabulary={globalVocabulary}
        onMergeGlobalVocabulary={mergeGlobalVocabulary}
        books={books}
      />

      {/* Quiz 弹窗 */}
      {showQuiz && (
        <VocabularyQuiz
          vocabulary={globalVocabulary}
          onCorrect={incrementCorrectCount}
          onClose={() => setShowQuiz(false)}
        />
      )}

      {/* 云同步面板 */}
      <SyncPanel
        isOpen={syncPanelOpen}
        onClose={() => {
          setSyncPanelOpen(false);
          setSyncJustCreated(false);
        }}
        syncCode={syncCode}
        syncing={syncing}
        lastSyncAt={lastSyncAt}
        syncError={syncError}
        onCreateSync={handleCreateSync}
        onBindCode={handleBindSync}
        onSync={handleSync}
        onUnbind={unbind}
        isDarkMode={isDarkMode}
        justCreated={syncJustCreated}
      />
    </>
  );
}
