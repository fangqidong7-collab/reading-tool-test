"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { BACKGROUND_THEMES } from "@/hooks/useReadingSettings";

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
  dictMode: 'zh' | 'en';
  onDictModeChange: (mode: 'zh' | 'en') => void;
  pageTurnRatio: number;
  onPageTurnRatioChange: (ratio: number) => void;
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
            </div>
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

          {/* Background Theme */}
          <div className="setting-item">
            <div className="setting-label">
              <span className="label-text">背景颜色</span>
            </div>
            <div className="theme-options">
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

        .mode-options {
          display: flex;
          gap: 8px;
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
