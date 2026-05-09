"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { BACKGROUND_THEMES, FONT_FAMILIES, type FontFamilySetting } from "@/hooks/useReadingSettings";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  fontSize: number;
  lineHeight: number;
  currentTheme: string;
  onFontSizeChange: (size: number) => void;
  onLineHeightChange: (height: number) => void;
  onThemeChange: (themeId: string) => void;
  onReset: () => void;
  headerBg: string;
  headerTextColor: string;
  textColor: string;
  isDarkMode: boolean;
  dictMode: 'zh' | 'en' | 'en-simple';
  onDictModeChange: (mode: 'zh' | 'en' | 'en-simple') => void;
  pageTurnRatio: number;
  onPageTurnRatioChange: (ratio: number) => void;
  clickToTurnPage: boolean;
  onClickToTurnPageChange: (v: boolean) => void;
  vocabLevel: string;
  onVocabLevelChange: (level: string) => void;
  fontFamily: FontFamilySetting;
  onFontFamilyChange: (family: FontFamilySetting) => void;
  autoTheme: boolean;
  onAutoThemeChange: (enabled: boolean) => void;
}

export function SettingsPanel({
  isOpen,
  onClose,
  fontSize,
  lineHeight,
  currentTheme,
  onFontSizeChange,
  onLineHeightChange,
  onThemeChange,
  onReset,
  headerBg,
  headerTextColor,
  textColor,
  isDarkMode,
  dictMode,
  onDictModeChange,
  pageTurnRatio,
  onPageTurnRatioChange,
  clickToTurnPage,
  onClickToTurnPageChange,
  vocabLevel,
  onVocabLevelChange,
  fontFamily,
  onFontFamilyChange,
  autoTheme,
  onAutoThemeChange,
}: SettingsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  // Handle escape key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("keydown", handleEsc);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="settings-backdrop" onClick={handleBackdropClick}>
      <div
        ref={panelRef}
        className="settings-panel"
        style={{
          backgroundColor: headerBg,
          color: headerTextColor,
        }}
      >
        <div className="settings-header">
          <h3>阅读设置</h3>
          <button className="settings-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="settings-content">
          {/* Font Size */}
          <div className="setting-item">
            <div className="setting-label">
              <span className="label-small">A</span>
              <span className="label-text">字体大小</span>
              <span className="label-large">A</span>
            </div>
            <div className="setting-control">
              <input
                type="range"
                min="14"
                max="28"
                step="2"
                value={fontSize}
                onChange={(e) => onFontSizeChange(Number(e.target.value))}
                className="slider"
              />
              <span className="setting-value" style={{ color: textColor }}>
                {fontSize}px
              </span>
            </div>
          </div>

          {/* Line Height */}
          <div className="setting-item">
            <div className="setting-label">
              <span className="label-text">紧凑</span>
              <span className="label-text">行间距</span>
              <span className="label-text">宽松</span>
            </div>
            <div className="setting-control">
              <input
                type="range"
                min="1.2"
                max="2.5"
                step="0.1"
                value={lineHeight}
                onChange={(e) => onLineHeightChange(Number(e.target.value))}
                className="slider"
              />
              <span className="setting-value" style={{ color: textColor }}>
                {lineHeight.toFixed(1)}
              </span>
            </div>
          </div>

          {/* Font Family */}
          <div className="setting-item">
            <div className="setting-label">
              <span className="label-text">字体</span>
            </div>
            <div className="font-grid">
              {FONT_FAMILIES.map((f) => (
                <button
                  key={f.id}
                  className={`font-btn ${fontFamily === f.id ? 'active' : ''}`}
                  onClick={() => onFontFamilyChange(f.id)}
                  style={{ fontFamily: f.css }}
                  title={f.desc}
                >
                  <span className="font-btn-label">{f.label}</span>
                  <span className="font-btn-preview">Aa</span>
                </button>
              ))}
            </div>
          </div>

          {/* Dictionary Mode (Chinese / English) */}
          <div className="setting-item">
            <div className="setting-label">
              <span className="label-text">释义语言</span>
            </div>
            <div className="mode-options">
              <button
                className={`mode-btn ${dictMode === 'zh' ? 'active' : ''}`}
                onClick={() => onDictModeChange('zh')}
              >
                中文
              </button>
              <button
                className={`mode-btn ${dictMode === 'en' ? 'active' : ''}`}
                onClick={() => onDictModeChange('en')}
              >
                English
              </button>
              <button
                className={`mode-btn ${dictMode === 'en-simple' ? 'active' : ''}`}
                onClick={() => onDictModeChange('en-simple')}
                title="Uses simple, everyday words to explain meanings (like a learner's dictionary)"
              >
                Easy English
              </button>
            </div>
          </div>

          {/* Vocab Level Pre-annotation */}
          <div className="setting-item">
            <div className="setting-label">
              <span className="label-text">词汇分级标注</span>
            </div>
            <div className="vocab-level-options">
              <button
                className={`mode-btn ${vocabLevel === 'off' ? 'active' : ''}`}
                onClick={() => onVocabLevelChange('off')}
                title="关闭词汇分级标注"
              >
                关闭
              </button>
              {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map((level) => (
                <button
                  key={level}
                  className={`mode-btn ${vocabLevel === level ? 'active' : ''}`}
                  onClick={() => onVocabLevelChange(level)}
                  title={`标注 ${level} 及以上级别词汇`}
                >
                  ≥{level}
                </button>
              ))}
            </div>
            {vocabLevel !== 'off' && (
              <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: '0.75rem' }}>
                {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const)
                  .filter((l) => {
                    const order = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
                    return order.indexOf(l) >= order.indexOf(vocabLevel);
                  })
                  .map((l) => {
                    const colors: Record<string, string> = {
                      A1: '#22c55e', A2: '#15803d', B1: '#3b82f6',
                      B2: '#f59e0b', C1: '#a855f7', C2: '#6d28d9',
                    };
                    const labels: Record<string, string> = {
                      A1: 'A1 基础', A2: 'A2 初级', B1: 'B1 中级',
                      B2: 'B2 中高级', C1: 'C1 高级', C2: 'C2 精通',
                    };
                    return <span key={l} style={{ color: colors[l] }}>● {labels[l]}</span>;
                  })}
              </div>
            )}
          </div>

          {/* Page Turn Ratio */}
          <div className="setting-item">
            <div className="setting-label">
              <span className="label-text">50%</span>
              <span className="label-text">翻页幅度</span>
              <span className="label-text">100%</span>
            </div>
            <div className="setting-control">
              <input
                type="range"
                min="0.5"
                max="1.0"
                step="0.05"
                value={pageTurnRatio}
                onChange={(e) => onPageTurnRatioChange(Number(e.target.value))}
                className="slider"
              />
              <span className="setting-value" style={{ color: textColor }}>
                {Math.round(pageTurnRatio * 100)}%
              </span>
            </div>
          </div>

          {/* Click to Turn Page */}
          <div className="setting-item">
            <div className="setting-label">
              <span className="label-text">点击翻页</span>
              <span className="label-text" style={{ fontSize: 12, opacity: 0.6 }}>
                {clickToTurnPage ? '点击屏幕左/右翻页' : '自由滑动浏览'}
              </span>
            </div>
            <div className="mode-options">
              <button
                className={`mode-btn ${!clickToTurnPage ? 'active' : ''}`}
                onClick={() => onClickToTurnPageChange(false)}
              >
                滑动模式
              </button>
              <button
                className={`mode-btn ${clickToTurnPage ? 'active' : ''}`}
                onClick={() => onClickToTurnPageChange(true)}
              >
                点击翻页
              </button>
            </div>
          </div>

          {/* Background Theme */}
          <div className="setting-item">
            <div className="setting-label">
              <span className="label-text">背景颜色</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, opacity: 0.7, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={autoTheme}
                  onChange={(e) => onAutoThemeChange(e.target.checked)}
                  style={{ width: 14, height: 14, cursor: 'pointer' }}
                />
                跟随系统
              </label>
            </div>
            <div className="theme-options" style={autoTheme ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
              {BACKGROUND_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  className={`theme-btn ${currentTheme === theme.id ? "active" : ""}`}
                  onClick={() => onThemeChange(theme.id)}
                  title={theme.name}
                  style={{
                    backgroundColor: theme.bg,
                    borderColor: currentTheme === theme.id ? (isDarkMode ? "#FF8C42" : "#4A90D9") : "#ddd",
                  }}
                >
                  {currentTheme === theme.id && (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={theme.text}
                      strokeWidth="3"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Reset Button */}
          <div className="setting-item">
            <button className="reset-btn" onClick={onReset}>
              恢复默认设置
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .settings-backdrop {
          position: fixed;
          top: 60px;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.3);
          z-index: 100;
          display: flex;
          justify-content: center;
          animation: fadeIn 0.15s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .settings-panel {
          width: 100%;
          max-width: 400px;
          max-height: calc(100vh - 80px);
          display: flex;
          flex-direction: column;
          border-radius: 0 0 16px 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
          animation: slideDown 0.2s ease;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .settings-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(128, 128, 128, 0.2);
        }

        .settings-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }

        .settings-close {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.7;
          transition: opacity 0.15s;
        }

        .settings-close:hover {
          opacity: 1;
        }

        .settings-content {
          padding: 20px;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }

        .setting-item {
          margin-bottom: 24px;
        }

        .setting-item:last-child {
          margin-bottom: 0;
        }

        .setting-label {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          font-size: 14px;
          font-weight: 500;
        }

        .label-small {
          font-size: 12px;
          opacity: 0.6;
        }

        .label-large {
          font-size: 18px;
          opacity: 0.6;
        }

        .setting-control {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .slider {
          flex: 1;
          height: 6px;
          border-radius: 3px;
          background: rgba(128, 128, 128, 0.3);
          appearance: none;
          cursor: pointer;
        }

        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #4a90d9;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
          transition: transform 0.15s;
        }

        .slider::-webkit-slider-thumb:hover {
          transform: scale(1.1);
        }

        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #4a90d9;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        }

        .setting-value {
          min-width: 50px;
          text-align: right;
          font-size: 14px;
          font-weight: 500;
        }

        .theme-options {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .theme-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 2px solid #ddd;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }

        .theme-btn:hover {
          transform: scale(1.1);
        }

        .theme-btn.active {
          border-width: 3px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .font-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .font-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          padding: 8px 4px 6px;
          border: 1px solid rgba(128, 128, 128, 0.3);
          border-radius: 8px;
          background: transparent;
          color: inherit;
          cursor: pointer;
          transition: all 0.15s;
        }

        .font-btn:hover {
          background: rgba(128, 128, 128, 0.1);
        }

        .font-btn.active {
          background: #4a90d9;
          color: white;
          border-color: #4a90d9;
        }

        :global(.dark) .font-btn.active {
          background: #6ba3e0;
          border-color: #6ba3e0;
        }

        .font-btn-label {
          font-size: 11px;
          line-height: 1.2;
          font-family: -apple-system, sans-serif !important;
        }

        .font-btn-preview {
          font-size: 18px;
          line-height: 1;
          opacity: 0.8;
        }

        .font-btn.active .font-btn-preview {
          opacity: 1;
        }

        .mode-options {
          display: flex;
          gap: 8px;
        }

        .vocab-level-options {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }

        .vocab-level-options .mode-btn {
          flex: none;
          padding: 6px 10px;
          font-size: 13px;
          min-width: 0;
        }

        .mode-btn {
          flex: 1;
          padding: 8px 16px;
          border: 1px solid rgba(128, 128, 128, 0.3);
          border-radius: 8px;
          background: transparent;
          color: inherit;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .mode-btn:hover {
          background: rgba(128, 128, 128, 0.1);
        }

        .mode-btn.active {
          background: #4a90d9;
          color: white;
          border-color: #4a90d9;
        }

        :global(.dark) .mode-btn.active {
          background: #6ba3e0;
          border-color: #6ba3e0;
        }

        .reset-btn {
          width: 100%;
          padding: 10px 16px;
          border: 1px solid rgba(128, 128, 128, 0.3);
          border-radius: 8px;
          background: transparent;
          color: inherit;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .reset-btn:hover {
          background: rgba(128, 128, 128, 0.1);
        }
      `}</style>
    </div>
  );
}
