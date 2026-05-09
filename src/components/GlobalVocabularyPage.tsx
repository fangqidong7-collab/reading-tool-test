"use client";

import React, { useState, useCallback, useRef } from "react";
import { speakWord } from "@/lib/speak";
import { getWordMeaning, getWordMeaningEn } from "@/lib/dictionary";
import { lookupExternalDict, lookupExternalDictEn } from "@/lib/dictLoader";
import { translateWord, translateWordEn, translateWordEnSimple } from "@/lib/translate";
import { shortenTranslation } from "@/lib/annotationText";

interface VocabItem {
  root: string;
  meaning: string;
  pos: string;
  correctCount: number;
  meaningZh?: string;
  meaningEn?: string;
  meaningEnSimple?: string;
}

interface GlobalVocabularyPageProps {
  vocabulary: Record<string, VocabItem>;
  onRemoveWord: (root: string) => void;
  onClearAll: () => void;
  onClearMastered: (threshold: number) => void;
  onStartQuiz: () => void;
  backgroundColor?: string;
  dictMode?: 'zh' | 'en' | 'en-simple';
  onMergeVocabulary?: (vocab: Record<string, { root: string; meaning: string; pos: string; meaningZh?: string; meaningEn?: string; meaningEnSimple?: string }>) => void;
}

function getDisplayMeaning(item: VocabItem, dictMode: string): string {
  if (dictMode === 'zh' && item.meaningZh) return item.meaningZh;
  if (dictMode === 'en' && item.meaningEn) return item.meaningEn;
  if (dictMode === 'en-simple' && item.meaningEnSimple) return item.meaningEnSimple;
  return item.meaning;
}

function lookupLocalAll(word: string): { zh?: string; en?: string; enSimple?: string } {
  const langs: { zh?: string; en?: string; enSimple?: string } = {};
  const zhEntry = getWordMeaning(word);
  const zhRaw = zhEntry?.meaning || lookupExternalDict(word) || '';
  if (zhRaw) langs.zh = shortenTranslation(zhRaw, 'zh');
  const enRaw = getWordMeaningEn(word) || lookupExternalDictEn(word) || '';
  if (enRaw) {
    langs.en = shortenTranslation(enRaw, 'en');
    langs.enSimple = shortenTranslation(enRaw, 'en-simple');
  }
  return langs;
}

async function aiTranslateWord(word: string, mode: 'zh' | 'en' | 'en-simple'): Promise<string> {
  try {
    let raw: string;
    if (mode === 'en-simple') raw = await translateWordEnSimple(word);
    else if (mode === 'en') raw = await translateWordEn(word);
    else raw = await translateWord(word);
    return shortenTranslation(raw, mode);
  } catch {
    return '';
  }
}

export function GlobalVocabularyPage({
  vocabulary,
  onRemoveWord,
  onClearAll,
  onClearMastered,
  onStartQuiz,
  backgroundColor = "#FFF8F0",
  dictMode = 'zh',
  onMergeVocabulary,
}: GlobalVocabularyPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [showClearMastered, setShowClearMastered] = useState(false);
  const [clearThreshold, setClearThreshold] = useState(3);
  const [migrateProgress, setMigrateProgress] = useState<{ done: number; total: number; phase: string } | null>(null);
  const migrateAbortRef = useRef(false);

  const vocabList = Object.values(vocabulary);

  const missingCount = vocabList.filter(
    (v) => !v.meaningZh || !v.meaningEn || !v.meaningEnSimple
  ).length;

  const handleMigrate = useCallback(async () => {
    if (!onMergeVocabulary || migrateProgress) return;
    migrateAbortRef.current = false;

    const entries = Object.entries(vocabulary);
    const needWork: { key: string; entry: VocabItem; missingModes: string[] }[] = [];

    for (const [key, entry] of entries) {
      const missing: string[] = [];
      if (!entry.meaningZh) missing.push('zh');
      if (!entry.meaningEn) missing.push('en');
      if (!entry.meaningEnSimple) missing.push('en-simple');
      if (missing.length > 0) needWork.push({ key, entry, missingModes: missing });
    }

    if (needWork.length === 0) return;

    setMigrateProgress({ done: 0, total: needWork.length, phase: '本地词典查找...' });

    const localPatch: Record<string, { root: string; meaning: string; pos: string; meaningZh?: string; meaningEn?: string; meaningEnSimple?: string }> = {};
    const needAI: typeof needWork = [];

    for (const item of needWork) {
      if (migrateAbortRef.current) break;
      const local = lookupLocalAll(item.key);
      const existingMeaning = item.entry.meaning || '';
      const hasChinese = /[\u4e00-\u9fff]/.test(existingMeaning);

      const mZh = local.zh || (hasChinese ? existingMeaning : undefined) || item.entry.meaningZh;
      const mEn = local.en || (!hasChinese && existingMeaning ? existingMeaning : undefined) || item.entry.meaningEn;
      const mEnSimple = local.enSimple || (!hasChinese && existingMeaning ? existingMeaning : undefined) || item.entry.meaningEnSimple;

      localPatch[item.key] = {
        root: item.entry.root, meaning: item.entry.meaning, pos: item.entry.pos,
        meaningZh: mZh, meaningEn: mEn, meaningEnSimple: mEnSimple,
      };

      const stillMissing: string[] = [];
      if (!mZh) stillMissing.push('zh');
      if (!mEn) stillMissing.push('en');
      if (!mEnSimple) stillMissing.push('en-simple');
      if (stillMissing.length > 0) {
        needAI.push({ ...item, missingModes: stillMissing });
      }
    }

    if (!migrateAbortRef.current && Object.keys(localPatch).length > 0) {
      onMergeVocabulary(localPatch);
    }

    if (needAI.length === 0 || migrateAbortRef.current) {
      setMigrateProgress(null);
      return;
    }

    setMigrateProgress({ done: 0, total: needAI.length, phase: 'AI 翻译补全...' });

    const CONCURRENCY = 3;
    let doneCount = 0;
    const queue = [...needAI];

    const worker = async () => {
      while (queue.length > 0 && !migrateAbortRef.current) {
        const item = queue.shift()!;
        const patch: Record<string, string | undefined> = {};
        for (const mode of item.missingModes) {
          if (migrateAbortRef.current) break;
          const translated = await aiTranslateWord(item.key, mode);
          if (translated) {
            if (mode === 'zh') patch.meaningZh = translated;
            else if (mode === 'en') patch.meaningEn = translated;
            else patch.meaningEnSimple = translated;
          }
        }
        if (!migrateAbortRef.current && Object.keys(patch).length > 0) {
          onMergeVocabulary({
            [item.key]: {
              root: item.entry.root, meaning: item.entry.meaning, pos: item.entry.pos,
              ...patch,
            },
          });
        }
        doneCount++;
        setMigrateProgress({ done: doneCount, total: needAI.length, phase: 'AI 翻译补全...' });
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, needAI.length) }, () => worker()));
    setMigrateProgress(null);
  }, [vocabulary, onMergeVocabulary, migrateProgress]);

  // 搜索过滤
  const filteredList = searchQuery.trim()
    ? vocabList.filter(
        (item) =>
          item.root.toLowerCase().includes(searchQuery.toLowerCase()) ||
          getDisplayMeaning(item, dictMode).toLowerCase().includes(searchQuery.toLowerCase())
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
          {vocabList.length >= 4 && (
            <button className="global-vocab-quiz-btn" onClick={onStartQuiz}>
              Quiz
            </button>
          )}
          {vocabList.length > 0 && (
            <button className="global-vocab-mastered-btn" onClick={() => setShowClearMastered(true)}>
              清除已掌握
            </button>
          )}
        </div>

        {/* 多语言补全 */}
        {onMergeVocabulary && vocabList.length > 0 && (
          <div className="global-vocab-migrate">
            {migrateProgress ? (
              <div className="migrate-progress">
                <div className="migrate-progress-info">
                  <span>{migrateProgress.phase} {migrateProgress.done}/{migrateProgress.total}</span>
                  <button
                    className="migrate-cancel-btn"
                    onClick={() => { migrateAbortRef.current = true; setMigrateProgress(null); }}
                  >
                    取消
                  </button>
                </div>
                <div className="migrate-progress-bar">
                  <div
                    className="migrate-progress-fill"
                    style={{ width: `${migrateProgress.total > 0 ? (migrateProgress.done / migrateProgress.total * 100) : 0}%` }}
                  />
                </div>
              </div>
            ) : missingCount > 0 ? (
              <button className="migrate-btn" onClick={handleMigrate}>
                补全多语言释义（{missingCount} 词待补全）
              </button>
            ) : (
              <div className="migrate-done">✓ 多语言释义已完整</div>
            )}
          </div>
        )}

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
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="global-vocab-word">{item.root}</span>
                    {(item.correctCount || 0) > 0 && (
                      <span className="global-vocab-correct-badge">
                        ✓ {item.correctCount}
                      </span>
                    )}
                  </div>
                  <span className="global-vocab-meaning">{getDisplayMeaning(item, dictMode)}</span>
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

      {/* 批量清除弹窗 */}
      {showClearMastered && (
        <div
          className="global-vocab-confirm-overlay"
          onClick={() => setShowClearMastered(false)}
        >
          <div
            className="global-vocab-confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="global-vocab-confirm-text">清除答对次数 ≥ N 的单词</p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                margin: "16px 0",
              }}
            >
              <span>N = </span>
              <input
                type="number"
                min={1}
                value={clearThreshold}
                onChange={(e) =>
                  setClearThreshold(Math.max(1, parseInt(e.target.value) || 1))
                }
                style={{
                  width: "60px",
                  padding: "6px",
                  border: "2px solid #ddd",
                  borderRadius: "8px",
                  textAlign: "center",
                  fontSize: "16px",
                  fontWeight: 600,
                }}
              />
              <span>次</span>
            </div>
            <p style={{ fontSize: "13px", color: "#999", textAlign: "center" }}>
              将清除{" "}
              {
                Object.values(vocabulary).filter(
                  (v) => (v.correctCount || 0) >= clearThreshold
                ).length
              }{" "}
              个单词
            </p>
            <div className="global-vocab-confirm-buttons">
              <button
                className="global-vocab-confirm-cancel"
                onClick={() => setShowClearMastered(false)}
              >
                取消
              </button>
              <button
                className="global-vocab-confirm-ok"
                onClick={() => {
                  onClearMastered(clearThreshold);
                  setShowClearMastered(false);
                }}
              >
                确定清除
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
          margin-bottom: 12px;
        }

        .global-vocab-migrate {
          margin-bottom: 12px;
        }

        .migrate-btn {
          width: 100%;
          padding: 8px 12px;
          border: 1px dashed rgba(74, 144, 217, 0.5);
          border-radius: 8px;
          background: rgba(74, 144, 217, 0.08);
          color: #4a90d9;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .migrate-btn:hover {
          background: rgba(74, 144, 217, 0.15);
          border-color: #4a90d9;
        }

        .migrate-done {
          text-align: center;
          padding: 6px;
          font-size: 12px;
          color: #22c55e;
          opacity: 0.7;
        }

        .migrate-progress {
          padding: 8px 12px;
          border: 1px solid rgba(74, 144, 217, 0.3);
          border-radius: 8px;
          background: rgba(74, 144, 217, 0.05);
        }

        .migrate-progress-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          color: #4a90d9;
          margin-bottom: 6px;
        }

        .migrate-cancel-btn {
          background: none;
          border: none;
          color: #e74c3c;
          font-size: 12px;
          cursor: pointer;
          padding: 2px 8px;
        }

        .migrate-progress-bar {
          height: 4px;
          border-radius: 2px;
          background: rgba(74, 144, 217, 0.15);
          overflow: hidden;
        }

        .migrate-progress-fill {
          height: 100%;
          background: #4a90d9;
          border-radius: 2px;
          transition: width 0.3s;
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

        .global-vocab-quiz-btn {
          padding: 6px 14px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          border-radius: 8px;
          font-size: 13px;
          color: white;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .global-vocab-quiz-btn:hover {
          opacity: 0.9;
          transform: scale(1.02);
        }

        .global-vocab-mastered-btn {
          padding: 6px 14px;
          background: none;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 13px;
          color: #999;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .global-vocab-mastered-btn:hover {
          border-color: #27ae60;
          color: #27ae60;
          background: rgba(39, 174, 96, 0.05);
        }

        .global-vocab-correct-badge {
          font-size: 11px;
          color: #27ae60;
          background: rgba(39, 174, 96, 0.1);
          padding: 2px 7px;
          border-radius: 10px;
          font-weight: 500;
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
