"use client";

import React, { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { ProcessedContent } from "@/hooks/useBookshelf";
import { getWordLevel, LEVEL_COLORS, LEVEL_LABELS, type CEFRLevel } from "@/lib/vocabLevel";
import { lemmatize } from "@/lib/dictionary";

interface BookVocabAnalysisProps {
  isOpen: boolean;
  onClose: () => void;
  processedContent: ProcessedContent | null;
  headerBg: string;
  headerTextColor: string;
  textColor: string;
  isDarkMode: boolean;
  backgroundColor: string;
}

interface WordStat {
  word: string;
  count: number;
  level: CEFRLevel | null;
}

const ALL_LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export function BookVocabAnalysis({
  isOpen,
  onClose,
  processedContent,
  headerBg,
  headerTextColor,
  textColor,
  isDarkMode,
  backgroundColor,
}: BookVocabAnalysisProps) {
  const [tab, setTab] = useState<'overview' | 'words'>('overview');
  const [filterLevel, setFilterLevel] = useState<CEFRLevel | 'unknown' | 'all'>('all');

  const analysis = useMemo(() => {
    if (!processedContent) return null;

    const wordCounts = new Map<string, { count: number; original: string }>();
    let totalWords = 0;

    for (const para of processedContent) {
      for (const seg of para.segments) {
        if (seg.type !== 'word') continue;
        totalWords++;
        const root = seg.lemma || lemmatize(seg.text.toLowerCase());
        const existing = wordCounts.get(root);
        if (existing) {
          existing.count++;
        } else {
          wordCounts.set(root, { count: 1, original: seg.text });
        }
      }
    }

    const levelCounts: Record<string, number> = {};
    const levelUniqueWords: Record<string, number> = {};
    let unknownCount = 0;
    let unknownUniqueCount = 0;

    ALL_LEVELS.forEach(l => { levelCounts[l] = 0; levelUniqueWords[l] = 0; });

    const words: WordStat[] = [];
    for (const [root, data] of wordCounts) {
      const level = getWordLevel(root);
      words.push({ word: root, count: data.count, level });
      if (level) {
        levelCounts[level] = (levelCounts[level] || 0) + data.count;
        levelUniqueWords[level] = (levelUniqueWords[level] || 0) + 1;
      } else {
        unknownCount += data.count;
        unknownUniqueCount++;
      }
    }

    words.sort((a, b) => b.count - a.count);

    return {
      totalWords,
      uniqueWords: wordCounts.size,
      levelCounts,
      levelUniqueWords,
      unknownCount,
      unknownUniqueCount,
      words,
    };
  }, [processedContent]);

  if (!isOpen || !analysis) return null;

  const filteredWords = filterLevel === 'all'
    ? analysis.words
    : filterLevel === 'unknown'
      ? analysis.words.filter(w => !w.level)
      : analysis.words.filter(w => w.level === filterLevel);

  const maxLevelCount = Math.max(...ALL_LEVELS.map(l => analysis.levelUniqueWords[l] || 0), analysis.unknownUniqueCount || 1);

  return (
    <div className="va-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="va-panel" style={{ backgroundColor: headerBg, color: headerTextColor }}>
        <div className="va-header">
          <h3>本书词汇分析</h3>
          <button className="va-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="va-tabs">
          <button className={`va-tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>
            等级分布
          </button>
          <button className={`va-tab ${tab === 'words' ? 'active' : ''}`} onClick={() => setTab('words')}>
            词汇详情
          </button>
        </div>

        <div className="va-body" style={{ backgroundColor, color: textColor }}>
          {tab === 'overview' && (
            <div className="va-overview">
              <div className="va-summary">
                <div className="va-stat-card">
                  <div className="va-stat-value">{analysis.totalWords.toLocaleString()}</div>
                  <div className="va-stat-label">总词数</div>
                </div>
                <div className="va-stat-card">
                  <div className="va-stat-value">{analysis.uniqueWords.toLocaleString()}</div>
                  <div className="va-stat-label">不重复词</div>
                </div>
              </div>

              <div className="va-chart">
                <div className="va-chart-title">CEFR 等级分布（不重复词）</div>
                {ALL_LEVELS.map(level => {
                  const count = analysis.levelUniqueWords[level] || 0;
                  const pct = analysis.uniqueWords > 0 ? (count / analysis.uniqueWords * 100) : 0;
                  const barWidth = maxLevelCount > 0 ? (count / maxLevelCount * 100) : 0;
                  return (
                    <div key={level} className="va-bar-row">
                      <div className="va-bar-label" style={{ color: LEVEL_COLORS[level] }}>
                        {level}
                      </div>
                      <div className="va-bar-track">
                        <div
                          className="va-bar-fill"
                          style={{ width: `${barWidth}%`, backgroundColor: LEVEL_COLORS[level] }}
                        />
                      </div>
                      <div className="va-bar-count">{count} <span className="va-bar-pct">({pct.toFixed(1)}%)</span></div>
                    </div>
                  );
                })}
                <div className="va-bar-row">
                  <div className="va-bar-label" style={{ color: isDarkMode ? '#888' : '#999' }}>超纲</div>
                  <div className="va-bar-track">
                    <div
                      className="va-bar-fill"
                      style={{
                        width: `${maxLevelCount > 0 ? (analysis.unknownUniqueCount / maxLevelCount * 100) : 0}%`,
                        backgroundColor: isDarkMode ? '#555' : '#ccc',
                      }}
                    />
                  </div>
                  <div className="va-bar-count">
                    {analysis.unknownUniqueCount}
                    <span className="va-bar-pct"> ({(analysis.uniqueWords > 0 ? analysis.unknownUniqueCount / analysis.uniqueWords * 100 : 0).toFixed(1)}%)</span>
                  </div>
                </div>
              </div>

              <div className="va-chart" style={{ marginTop: 16 }}>
                <div className="va-chart-title">各级别占总词频</div>
                {ALL_LEVELS.map(level => {
                  const count = analysis.levelCounts[level] || 0;
                  const pct = analysis.totalWords > 0 ? (count / analysis.totalWords * 100) : 0;
                  return (
                    <div key={level} className="va-freq-row">
                      <span style={{ color: LEVEL_COLORS[level], fontWeight: 600, width: 28 }}>{level}</span>
                      <span className="va-freq-pct">{pct.toFixed(1)}%</span>
                      <span className="va-freq-count" style={{ opacity: 0.6 }}>({count.toLocaleString()}次)</span>
                    </div>
                  );
                })}
                <div className="va-freq-row">
                  <span style={{ color: isDarkMode ? '#888' : '#999', fontWeight: 600, width: 28 }}>超纲</span>
                  <span className="va-freq-pct">
                    {(analysis.totalWords > 0 ? analysis.unknownCount / analysis.totalWords * 100 : 0).toFixed(1)}%
                  </span>
                  <span className="va-freq-count" style={{ opacity: 0.6 }}>({analysis.unknownCount.toLocaleString()}次)</span>
                </div>
              </div>
            </div>
          )}

          {tab === 'words' && (
            <div className="va-words">
              <div className="va-filter">
                <button
                  className={`va-filter-btn ${filterLevel === 'all' ? 'active' : ''}`}
                  onClick={() => setFilterLevel('all')}
                >全部</button>
                {ALL_LEVELS.map(l => (
                  <button
                    key={l}
                    className={`va-filter-btn ${filterLevel === l ? 'active' : ''}`}
                    onClick={() => setFilterLevel(l)}
                    style={filterLevel === l ? { backgroundColor: LEVEL_COLORS[l], borderColor: LEVEL_COLORS[l] } : undefined}
                  >{l}</button>
                ))}
                <button
                  className={`va-filter-btn ${filterLevel === 'unknown' ? 'active' : ''}`}
                  onClick={() => setFilterLevel('unknown')}
                >超纲</button>
              </div>

              <div className="va-word-count" style={{ opacity: 0.6 }}>
                共 {filteredWords.length} 个词
              </div>

              <div className="va-word-list">
                {filteredWords.slice(0, 200).map((w) => (
                  <div key={w.word} className="va-word-item">
                    <span className="va-word-text">{w.word}</span>
                    <span className="va-word-level" style={{ color: w.level ? LEVEL_COLORS[w.level] : (isDarkMode ? '#888' : '#999') }}>
                      {w.level ? LEVEL_LABELS[w.level] : '超纲'}
                    </span>
                    <span className="va-word-freq">×{w.count}</span>
                  </div>
                ))}
                {filteredWords.length > 200 && (
                  <div style={{ padding: 12, textAlign: 'center', opacity: 0.5, fontSize: 13 }}>
                    仅显示前 200 个词
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .va-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: vaFadeIn 0.15s ease;
        }
        @keyframes vaFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .va-panel {
          width: 90%;
          max-width: 480px;
          max-height: 85vh;
          border-radius: 16px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.2);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: vaSlideUp 0.2s ease;
        }
        @keyframes vaSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .va-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(128,128,128,0.2);
        }
        .va-header h3 { margin: 0; font-size: 16px; font-weight: 600; }
        .va-close {
          background: none; border: none; cursor: pointer;
          padding: 4px; border-radius: 4px; display: flex;
          opacity: 0.7; transition: opacity 0.15s; color: inherit;
        }
        .va-close:hover { opacity: 1; }
        .va-tabs {
          display: flex;
          border-bottom: 1px solid rgba(128,128,128,0.2);
        }
        .va-tab {
          flex: 1;
          padding: 10px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          font-size: 14px;
          color: inherit;
          opacity: 0.6;
          transition: all 0.15s;
        }
        .va-tab.active {
          opacity: 1;
          border-bottom-color: #4a90d9;
          font-weight: 600;
        }
        .va-body {
          flex: 1;
          overflow-y: auto;
          padding: 16px 20px;
          -webkit-overflow-scrolling: touch;
        }
        .va-summary {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
        }
        .va-stat-card {
          flex: 1;
          padding: 14px;
          border-radius: 12px;
          background: rgba(128,128,128,0.08);
          text-align: center;
        }
        .va-stat-value { font-size: 24px; font-weight: 700; }
        .va-stat-label { font-size: 12px; opacity: 0.6; margin-top: 4px; }
        .va-chart-title {
          font-size: 13px;
          font-weight: 600;
          opacity: 0.7;
          margin-bottom: 10px;
        }
        .va-bar-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }
        .va-bar-label { width: 28px; font-size: 13px; font-weight: 600; text-align: right; }
        .va-bar-track {
          flex: 1;
          height: 18px;
          border-radius: 9px;
          background: rgba(128,128,128,0.1);
          overflow: hidden;
        }
        .va-bar-fill {
          height: 100%;
          border-radius: 9px;
          transition: width 0.4s ease;
          min-width: 2px;
        }
        .va-bar-count { font-size: 12px; min-width: 80px; text-align: right; }
        .va-bar-pct { opacity: 0.5; }
        .va-freq-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
          font-size: 13px;
        }
        .va-freq-pct { min-width: 48px; text-align: right; font-weight: 600; }
        .va-freq-count { font-size: 12px; }
        .va-filter {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }
        .va-filter-btn {
          padding: 4px 10px;
          border: 1px solid rgba(128,128,128,0.3);
          border-radius: 6px;
          background: transparent;
          color: inherit;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .va-filter-btn:hover { background: rgba(128,128,128,0.1); }
        .va-filter-btn.active {
          background: #4a90d9;
          color: white;
          border-color: #4a90d9;
        }
        .va-word-count { font-size: 12px; margin-bottom: 8px; }
        .va-word-list { display: flex; flex-direction: column; }
        .va-word-item {
          display: flex;
          align-items: center;
          padding: 6px 0;
          border-bottom: 1px solid rgba(128,128,128,0.08);
          font-size: 14px;
        }
        .va-word-text { flex: 1; font-weight: 500; }
        .va-word-level { font-size: 11px; margin-right: 12px; }
        .va-word-freq { font-size: 12px; opacity: 0.5; min-width: 40px; text-align: right; }
      `}</style>
    </div>
  );
}
