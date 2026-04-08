"use client";

import React, { useState, useEffect } from "react";
import { lemmatize, getWordMeaning } from "@/lib/dictionary";

interface WordTooltipProps {
  word: string;
  position: { x: number; y: number };
  onAnnotateAll: (word: string) => void;
  onRemoveAnnotation: (word: string) => void;
  onClose: () => void;
  isAnnotated: boolean;
  annotation?: {
    root: string;
    meaning: string;
    pos: string;
  } | null;
  // Dark mode
  isDarkMode?: boolean;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
}

export function WordTooltip({
  word,
  position,
  onAnnotateAll,
  onRemoveAnnotation,
  onClose,
  isAnnotated,
  annotation,
  isDarkMode = false,
  bgColor = "#FFFFFF",
  textColor = "#333333",
  accentColor = "#4a90d9",
}: WordTooltipProps) {
  const [visible, setVisible] = useState(false);
  const root = lemmatize(word);
  const entry = annotation || getWordMeaning(root);

  useEffect(() => {
    // 延迟显示以实现淡入效果
    const timer = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleScroll = () => onClose();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Dark mode colors
  const colors = {
    bg: isDarkMode ? "#2a2a3e" : bgColor,
    text: isDarkMode ? "#e0e0e0" : textColor,
    secondaryText: isDarkMode ? "#888" : "#888",
    accent: isDarkMode ? "#6ba3e0" : accentColor,
    border: isDarkMode ? "#444" : "#eee",
    buttonHover: isDarkMode ? "#3a3a4e" : "#f0f0f0",
  };

  // 计算tooltip位置
  const tooltipStyle: React.CSSProperties = {
    position: "fixed",
    left: Math.max(10, Math.min(position.x - 100, window.innerWidth - 220)),
    top: Math.max(10, position.y - 80),
    zIndex: 1000,
  };

  return (
    <>
      {/* 背景遮罩 */}
      <div className="tooltip-backdrop" onClick={onClose} />

      {/* Tooltip */}
      <div
        className={`word-tooltip ${visible ? "visible" : ""}`}
        style={{ ...tooltipStyle, backgroundColor: colors.bg }}
      >
        <div className="tooltip-header">
          <span className="tooltip-word" style={{ color: colors.text }}>
            {word}
          </span>
          {entry && (
            <span className="tooltip-pos" style={{ color: colors.secondaryText }}>
              {entry.pos}
            </span>
          )}
        </div>

        {entry ? (
          <div className="tooltip-meaning" style={{ color: colors.accent }}>
            {entry.meaning}
          </div>
        ) : (
          <div className="tooltip-meaning tooltip-unknown" style={{ color: colors.secondaryText }}>
            未找到释义
          </div>
        )}

        {entry && (
          <div className="tooltip-root" style={{ color: colors.secondaryText }}>
            词根: {root}
          </div>
        )}

        <div className="tooltip-actions">
          {isAnnotated ? (
            <button
              className="tooltip-btn tooltip-btn-remove"
              onClick={() => onRemoveAnnotation(word)}
            >
              取消标注
            </button>
          ) : (
            <button
              className="tooltip-btn tooltip-btn-annotate"
              style={{ backgroundColor: colors.accent }}
              onClick={() => onAnnotateAll(word)}
            >
              标注全文
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        .tooltip-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 999;
        }

        .word-tooltip {
          position: fixed;
          width: 200px;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
          padding: 12px;
          z-index: 1000;
          opacity: 0;
          transform: translateY(5px);
          transition: opacity 0.2s ease, transform 0.2s ease;
        }

        .word-tooltip.visible {
          opacity: 1;
          transform: translateY(0);
        }

        .tooltip-header {
          display: flex;
          align-items: baseline;
          gap: 8px;
          margin-bottom: 8px;
        }

        .tooltip-word {
          font-size: 18px;
          font-weight: 600;
          font-family: Georgia, serif;
        }

        .tooltip-pos {
          font-size: 12px;
        }

        .tooltip-meaning {
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 6px;
        }

        .tooltip-unknown {
          font-style: italic;
        }

        .tooltip-root {
          font-size: 12px;
          margin-bottom: 10px;
        }

        .tooltip-actions {
          display: flex;
          gap: 8px;
        }

        .tooltip-btn {
          flex: 1;
          padding: 8px 12px;
          border: none;
          border-radius: 4px;
          font-size: 13px;
          cursor: pointer;
          transition: background-color 0.15s ease;
          color: white;
        }

        .tooltip-btn-annotate:hover {
          filter: brightness(1.1);
        }

        .tooltip-btn-remove {
          background: #e74c3c;
          color: white;
        }

        .tooltip-btn-remove:hover {
          background: #c0392b;
        }
      `}</style>
    </>
  );
}
