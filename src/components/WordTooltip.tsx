"use client";

import React, { useState, useEffect } from "react";
import { lemmatize, getWordMeaning, getWordMeaningEn } from "@/lib/dictionary";
import { lookupExternalDict, lookupExternalDictEn } from "@/lib/dictLoader";
import { speakWord } from "@/lib/speak";


interface WordTooltipProps {
  word: string;
  /** 与正文 data-lemma 一致；不传则用 lemmatize(word) */
  lemma?: string;
  position: { x: number; y: number };
  onAnnotateAll: (word: string) => void;
  onRemoveAnnotation: () => void;
  onClose: () => void;
  isAnnotated: boolean;
  annotation?: {
    root: string;
    meaning: string;
    pos: string;
  } | null;
  dictMode?: "zh" | "en" | "en-simple";
  // Dark mode
  isDarkMode?: boolean;
  bgColor?: string;
  textColor?: string;
  accentColor?: string;
}


/**
 * Shorten translation text - keep only 1-2 most concise meanings
 */
function shortenTranslation(text: string): string {
  if (!text) return '未知';
  
  // First, clean the text (remove POS tags, brackets, etc.)
  let cleaned = text;
  cleaned = cleaned.replace(/^[a-z]+\.(?:\/[a-z]+\.)*\s*/gi, '');
  cleaned = cleaned.replace(/^(名词|动词|形容词|副词|介词|连词|代词|冠词|感叹词|数词|前缀|后缀)[;；\s]*/g, '');
  cleaned = cleaned.replace(/^[.。:：]+/, '');
  cleaned = cleaned.replace(/\[[^\]]+\]/g, '');
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/^[，。、；：.!?,]+/, '').replace(/[，。、；：.!?,]+$/, '');
  cleaned = cleaned.trim();
  
  if (!cleaned) return '未知';
  
  // Split by various separators
  let items = cleaned.split(/[;；,，、/\n\\n]+/);
  
  // Clean each item and filter: must have Chinese characters, max 6 chars each
  items = items
    .map(s => s.trim())
    .filter(s => s.length > 0 && s.length <= 6)
    .filter(s => /[\u4e00-\u9fff]/.test(s));
  
  // Take first 2 items
  items = items.slice(0, 2);
  
  if (items.length === 0) {
    // Fallback: be more lenient, just take first 2 parts and extract Chinese
    items = cleaned.split(/[;；,，、/\n\\n]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .slice(0, 2);
    // Extract Chinese characters only, max 4 chars each
    items = items.map(s => {
      const chinese = s.replace(/[^\u4e00-\u9fff]/g, '');
      return chinese.substring(0, 4);
    }).filter(s => s.length > 0);
  }
  
  return items.length > 0 ? items.join(',') : '未知';
}

export function WordTooltip({
  word,
  lemma,
  position,
  onAnnotateAll,
  onRemoveAnnotation,
  onClose,
  isAnnotated,
  annotation,
  dictMode = "zh",
  isDarkMode = false,
  bgColor = "#FFFFFF",
  textColor = "#333333",
  accentColor = "#4a90d9",
}: WordTooltipProps) {

  const [visible, setVisible] = useState(false);
  const root =
    lemma !== undefined && lemma.trim().length > 0 ? lemma.trim() : lemmatize(word);
  
  // 智能查词：先查内置词典，再查外部词典，最后精简
const internalZhEntry = annotation || getWordMeaning(root);
const externalZhRaw = !annotation
  ? (lookupExternalDict(root) || lookupExternalDict(word))
  : null;

const externalEnRaw = !annotation
  ? (lookupExternalDictEn(root) || lookupExternalDictEn(word))
  : null;

const isEnMode = dictMode === "en" || dictMode === "en-simple";
const displayMeaning =
  isEnMode
    ? (annotation?.meaning || getWordMeaningEn(root) || externalEnRaw || null)
    : (internalZhEntry
        ? shortenTranslation(internalZhEntry.meaning)
        : (externalZhRaw ? shortenTranslation(externalZhRaw) : null));

const displayEntry = displayMeaning
  ? {
      meaning: displayMeaning,
      pos: isEnMode ? "" : (internalZhEntry?.pos || ""),
    }
  : null;


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
          {displayEntry && (
            <span className="tooltip-pos" style={{ color: colors.secondaryText }}>
              {displayEntry.pos}
            </span>
          )}
          {/* 发音按钮 */}
          <button
            className="tooltip-speak-btn"
            onClick={(e) => {
              e.stopPropagation();
              speakWord(word);
            }}
            title="播放发音"
            style={{ color: colors.accent }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          </button>
        </div>

        {displayEntry ? (
          <div className="tooltip-meaning" style={{ color: colors.accent }}>
            {displayEntry.meaning}
          </div>
        ) : (
<div className="tooltip-meaning tooltip-unknown" style={{ color: colors.secondaryText }}>
  {isEnMode ? "No definition found" : "未找到释义"}
</div>

        )}

        {displayEntry && (
          <div className="tooltip-root" style={{ color: colors.secondaryText }}>
            词根: {root}
          </div>
        )}

        <div className="tooltip-actions">
          {isAnnotated ? (
            <button
              className="tooltip-btn tooltip-btn-remove"
              onClick={() => onRemoveAnnotation()}
            >
              取消标注
            </button>
          ) : (
            <button
              className="tooltip-btn tooltip-btn-annotate"
              style={{ backgroundColor: colors.accent }}
onClick={() => { onClose(); setTimeout(() => onAnnotateAll(word), 50); }}


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

        .tooltip-speak-btn {
          margin-left: auto;
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.7;
          transition: opacity 0.15s ease, transform 0.15s ease;
          flex-shrink: 0;
        }

        .tooltip-speak-btn:hover {
          opacity: 1;
          transform: scale(1.1);
        }

        .tooltip-speak-btn:active {
          transform: scale(0.95);
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
