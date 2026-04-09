"use client";

import React, { useCallback, useRef, useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { ProcessedContent } from "@/hooks/useBookshelf";

// Layout constants
const HEADER_HEIGHT = 56;
const MOBILE_HEADER_HEIGHT = 48;
const READING_PADDING_HORIZONTAL = 32;
const MOBILE_READING_PADDING_HORIZONTAL = 12;
const PARAGRAPH_GAP = 16;
const MOBILE_BREAKPOINT = 768;
const MOBILE_TOP_GAP = 5;
const MOBILE_BOTTOM_SAFE_ZONE = 60;

// Ref type
export interface ReadingAreaRef {
  jumpToParagraph: (paragraphIndex: number) => void;
  jumpToSearchResult: (result: { paragraphIndex: number; charIndex: number }) => void;
  getScrollPercent: () => number;
  addBookmark: () => void;
  restoreScrollPosition: (percent: number) => void;
}

// Bookmark interface
export interface Bookmark {
  id: string;
  scrollRatio: number;
  percent: number;
  preview: string;
  createdAt: number;
}

// Memoized paragraph component
type Annotations = Record<string, { root: string; meaning: string; pos: string; count: number }>;

interface ParagraphProps {
  paragraph: ProcessedContent[number];
  pIndex: number;
  onWordClick: (word: string, lemma: string, event: React.MouseEvent) => void;
  annotations?: Annotations;
  annotationColor?: string;
  searchQuery?: string;
  isCurrentSearchResult?: boolean;
  highlightBg?: string;
  isDarkMode?: boolean;
}

const Paragraph = React.memo(({
  paragraph,
  pIndex,
  onWordClick,
  annotations,
  annotationColor = "#E74C3C",
  searchQuery = "",
  isCurrentSearchResult = false,
  highlightBg = "#FFEB3B",
  isDarkMode = false,
}: ParagraphProps) => {
  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('word')) {
      const word = target.dataset.word || '';
      const lemma = target.dataset.lemma || '';
      onWordClick(word, lemma, e);
    }
  }, [onWordClick]);

  // Check if this is a heading paragraph
  const isHeading = paragraph.headingLevel !== undefined;
  const headingLevel = paragraph.headingLevel || 2;

  // Build text content for search matching
  const fullText = paragraph.segments.map(s => s.text).join('');

  // Get heading styles based on level
  const getHeadingStyles = (): React.CSSProperties => {
    const baseColor = isDarkMode ? "#E0E0E0" : "#333";
    switch (headingLevel) {
      case 1:
        return {
          fontSize: '1.6em',
          fontWeight: 'bold',
          textAlign: 'center',
          marginTop: '40px',
          marginBottom: '20px',
          color: baseColor,
        };
      case 2:
        return {
          fontSize: '1.4em',
          fontWeight: 'bold',
          textAlign: 'center',
          marginTop: '30px',
          marginBottom: '16px',
          color: baseColor,
        };
      case 3:
        return {
          fontSize: '1.2em',
          fontWeight: 'bold',
          marginTop: '24px',
          marginBottom: '12px',
          color: baseColor,
        };
      default: // h4-h6
        return {
          fontSize: '1.1em',
          fontWeight: 'bold',
          marginTop: '20px',
          marginBottom: '10px',
          color: baseColor,
        };
    }
  };

  return (
    <p 
      className={`paragraph ${isHeading ? 'heading-paragraph' : ''} ${isCurrentSearchResult ? 'search-highlight' : ''}`}
      data-paragraph-index={pIndex}
      data-heading-level={isHeading ? headingLevel : undefined}
      onClick={handleClick}
      style={isCurrentSearchResult ? { backgroundColor: highlightBg } : (isHeading ? getHeadingStyles() : undefined)}
    >
      {paragraph.segments.map((segment, sIndex) => {
        const key = `${pIndex}-${sIndex}`;
        if (segment.type === "space" || segment.type === "punctuation") {
          return <span key={key}>{segment.text}</span>;
        }
        
        const lemma = segment.lemma;
        const annotation = annotations?.[lemma];
        const isAnnotated = !!annotation;
        
        return (
          <React.Fragment key={key}>
            <span 
              className="word" 
              data-word={segment.text}
              data-lemma={lemma}
            >
              {segment.text}
            </span>
            {isAnnotated && (
              <span 
                className="annotation"
                style={{ 
                  color: annotationColor,
                  fontSize: '0.7em',
                  fontFamily: '"Microsoft YaHei", "微软雅黑", sans-serif',
                }}
              >
                ({annotation.meaning})
              </span>
            )}
          </React.Fragment>
        );
      })}
    </p>
  );
});

Paragraph.displayName = "Paragraph";

// Custom comparison function
function paragraphPropsAreEqual(
  prev: {
    paragraph: ProcessedContent[number];
    pIndex: number;
    onWordClick: (word: string, lemma: string, event: React.MouseEvent) => void;
    annotations?: Annotations;
    annotationColor?: string;
    searchQuery?: string;
    isCurrentSearchResult?: boolean;
    highlightBg?: string;
    isDarkMode?: boolean;
  },
  next: {
    paragraph: ProcessedContent[number];
    pIndex: number;
    onWordClick: (word: string, lemma: string, event: React.MouseEvent) => void;
    annotations?: Annotations;
    annotationColor?: string;
    searchQuery?: string;
    isCurrentSearchResult?: boolean;
    highlightBg?: string;
    isDarkMode?: boolean;
  }
) {
  if (prev.pIndex !== next.pIndex) return false;
  if (prev.onWordClick !== next.onWordClick) return false;
  if (prev.annotationColor !== next.annotationColor) return false;
  if (prev.searchQuery !== next.searchQuery) return false;
  if (prev.isCurrentSearchResult !== next.isCurrentSearchResult) return false;
  if (prev.highlightBg !== next.highlightBg) return false;
  if (prev.isDarkMode !== next.isDarkMode) return false;
  
  const prevKeys = prev.annotations ? Object.keys(prev.annotations) : [];
  const nextKeys = next.annotations ? Object.keys(next.annotations) : [];
  
  if (prevKeys.length !== nextKeys.length) return false;
  
  for (const key of nextKeys) {
    if (!prev.annotations?.[key] || prev.annotations[key] !== next.annotations?.[key]) {
      return false;
    }
  }
  
  return true;
}

const MemoizedParagraph = React.memo(Paragraph, paragraphPropsAreEqual);

interface ReadingAreaProps {
  text: string;
  processedContent?: ProcessedContent | null;
  annotations?: Record<string, { root: string; meaning: string; pos: string; count: number }>;
  onWordClick: (word: string, lemma: string, event: React.MouseEvent) => void;
  getWordAnnotation: (word: string) => { root: string; meaning: string; pos: string; count: number } | null;
  isClickable: (word: string) => boolean;
  fontSize?: number;
  lineHeight?: number;
  textColor?: string;
  backgroundColor?: string;
  annotationColor?: string;
  annotationFontSize?: number;
  highlightBg?: string;
  highlightBgHover?: string;
  isDarkMode?: boolean;
  headerVisible?: boolean;
  searchQuery?: string;
  searchResults?: Array<{ paragraphIndex: number; charIndex: number }>;
  currentSearchIndex?: number;
  bookId?: string;
  onProgressChange?: (percent: number) => void;
  onAddBookmark?: () => void;
  initialScrollPercent?: number;
}

export const ReadingArea = forwardRef(function ReadingArea({
  text,
  processedContent,
  annotations,
  onWordClick,
  getWordAnnotation,
  isClickable,
  fontSize = 18,
  lineHeight = 1.8,
  textColor = "#333333",
  backgroundColor = "#FFF8F0",
  annotationColor = "#E74C3C",
  highlightBg = "#FFEB3B",
  highlightBgHover = "#FFD700",
  isDarkMode = false,
  headerVisible = true,
  searchQuery = "",
  searchResults = [],
  currentSearchIndex = 0,
  bookId = "",
  onProgressChange,
  onAddBookmark,
  initialScrollPercent = 0,
}: ReadingAreaProps, ref: React.Ref<ReadingAreaRef>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  const [readProgress, setReadProgress] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);

  useEffect(() => {
    const calcHeight = () => {
      const mobile = window.innerWidth <= MOBILE_BREAKPOINT;
      const headerH = mobile ? MOBILE_HEADER_HEIGHT : HEADER_HEIGHT;
      const h = mobile
        ? window.innerHeight - headerH - MOBILE_TOP_GAP - MOBILE_BOTTOM_SAFE_ZONE
        : window.innerHeight - headerH;
      setContainerHeight(Math.max(h, 200));
    };
    calcHeight();
    window.addEventListener('resize', calcHeight);
    return () => window.removeEventListener('resize', calcHeight);
  }, []);

  // 计算滚动百分比
  const getScrollPercent = useCallback(() => {
    if (!containerRef.current) return 0;
    const el = containerRef.current;
    if (el.scrollHeight <= el.clientHeight) return 100;
    return Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100);
  }, []);

  // 监听滚动，更新进度
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const percent = getScrollPercent();
          setReadProgress(percent);
          if (onProgressChange) {
            onProgressChange(percent);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [getScrollPercent, onProgressChange]);

  // 跳转到段落（滚动方式）
  const jumpToParagraph = useCallback((paragraphIndex: number) => {
    if (!contentRef.current || !containerRef.current) return;
    const paragraphEls = contentRef.current.querySelectorAll('.paragraph');
    if (paragraphIndex >= 0 && paragraphIndex < paragraphEls.length) {
      const targetEl = paragraphEls[paragraphIndex] as HTMLElement;
      containerRef.current.scrollTop = targetEl.offsetTop - 20;
    }
  }, []);

  // 添加书签
  const addBookmarkFn = useCallback(() => {
    if (!containerRef.current || !contentRef.current || !bookId) return;
    
    const el = containerRef.current;
    const scrollRatio = el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight);
    const percent = getScrollPercent();
    
    // 获取当前可视区域第一个段落的文字作为预览
    const paragraphEls = contentRef.current.querySelectorAll('.paragraph');
    let preview = '';
    for (const pEl of paragraphEls) {
      const rect = (pEl as HTMLElement).getBoundingClientRect();
      const containerRect = el.getBoundingClientRect();
      if (rect.top >= containerRect.top && rect.top < containerRect.bottom) {
        preview = (pEl as HTMLElement).textContent?.substring(0, 50) || '';
        break;
      }
    }
    
    const bookmark: Bookmark = {
      id: `bm_${Date.now()}`,
      scrollRatio,
      percent,
      preview,
      createdAt: Date.now(),
    };
    
    const key = `book_${bookId}_bookmarks`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.push(bookmark);
    localStorage.setItem(key, JSON.stringify(existing));
    
    if (onAddBookmark) {
      onAddBookmark();
    }
  }, [bookId, getScrollPercent, onAddBookmark]);

  // 打开书籍时自动恢复上次滚动位置
  const hasRestoredRef = useRef(false);
  
  useEffect(() => {
    if (
      hasRestoredRef.current ||
      !initialScrollPercent ||
      initialScrollPercent <= 0 ||
      !containerRef.current ||
      !processedContent ||
      processedContent.length === 0
    ) {
      return;
    }
    
    let attempts = 0;
    const maxAttempts = 10;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tryRestore = () => {
      const el = containerRef.current;
      if (!el) return;
      const maxScroll = el.scrollHeight - el.clientHeight;
      
      if (maxScroll <= 0 && attempts < maxAttempts) {
        attempts++;
        timer = setTimeout(tryRestore, 200);
        return;
      }
      
      if (maxScroll > 0) {
        el.scrollTop = (initialScrollPercent / 100) * maxScroll;
        hasRestoredRef.current = true;
        console.log('ReadingArea 恢复滚动位置:', initialScrollPercent, '%, maxScroll:', maxScroll, ', 尝试次数:', attempts + 1);
      } else {
        console.warn('ReadingArea 无法恢复滚动位置: maxScroll 仍为 0');
      }
    };

    timer = setTimeout(tryRestore, 300);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [initialScrollPercent, processedContent]);
  
  useEffect(() => {
    hasRestoredRef.current = false;
  }, [bookId]);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    jumpToParagraph,
    jumpToSearchResult: (result: { paragraphIndex: number; charIndex: number }) => {
      jumpToParagraph(result.paragraphIndex);
    },
    getScrollPercent,
    addBookmark: addBookmarkFn,
    restoreScrollPosition: (percent: number) => {
      const el = containerRef.current;
      if (!el) return;
      const ratio = percent / 100;
      const maxScroll = el.scrollHeight - el.clientHeight;
      el.scrollTop = maxScroll * ratio;
    },
  }));

  if (processedContent && processedContent.length > 0) {
    const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
    const currentHorizPadding = isMobile ? MOBILE_READING_PADDING_HORIZONTAL : READING_PADDING_HORIZONTAL;

    return (
      <div 
        className="reading-wrapper" 
        style={{ 
          backgroundColor,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* 阅读容器 - 滚动模式 */}
        <div 
          ref={containerRef}
          className="reading-container"
          style={{
            height: containerHeight,
            overflowY: "auto",
            overflowX: "hidden",
            position: "relative",
            padding: "0px",
            boxSizing: "border-box",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div 
            ref={contentRef}
            className="reader-content"
            style={{
              paddingLeft: `${currentHorizPadding}px`,
              paddingRight: `${currentHorizPadding}px`,
              paddingTop: "20px",
              paddingBottom: "40px",
            }}
          >
            {processedContent.map((paragraph, pIndex) => (
              <MemoizedParagraph
                key={pIndex}
                paragraph={paragraph}
                pIndex={pIndex}
                onWordClick={onWordClick}
                annotations={annotations}
                annotationColor={annotationColor}
                searchQuery={searchQuery}
                isCurrentSearchResult={searchResults.length > 0 && searchResults[currentSearchIndex]?.paragraphIndex === pIndex}
                highlightBg={highlightBg}
                isDarkMode={isDarkMode}
              />
            ))}
          </div>
        </div>

        {/* 滚动进度指示器 */}
        <div style={{
          position: "fixed",
          bottom: 12,
          right: 16,
          fontSize: "12px",
          color: isDarkMode ? "#888" : "#999",
          background: isDarkMode ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.85)",
          padding: "4px 10px",
          borderRadius: "12px",
          zIndex: 100,
          pointerEvents: "none",
        }}>
          {readProgress}%
        </div>

        <style jsx>{`
          .reading-wrapper {
            min-height: 100vh;
            position: relative;
          }

          .reading-container {
            flex: 1;
          }

          .reader-content {
            font-size: ${fontSize}px;
            line-height: ${lineHeight};
            color: ${textColor};
            font-family: Georgia, "Times New Roman", serif;
            text-align: justify;
          }

          .reader-content :global(.paragraph) {
            margin-bottom: 16px;
            margin-top: 0px;
          }

          .reader-content :global(.word) {
            cursor: pointer;
            transition: color 0.15s;
          }

          .reader-content :global(.word:hover) {
            color: #4A90D9;
          }

          .reader-content :global(.annotation) {
            color: ${annotationColor};
            font-size: 0.7em;
            font-family: "Microsoft YaHei", "微软雅黑", sans-serif;
          }

          @media (max-width: 768px) {
            .reading-wrapper {
              min-height: 100dvh !important;
              height: 100dvh !important;
            }
          }
        `}</style>
      </div>
    );
  }

  // 无内容时显示原文
  return (
    <div className="reading-wrapper" style={{ backgroundColor, minHeight: '100vh' }}>
      <div 
        className="reading-area"
        style={{
          padding: `40px ${READING_PADDING_HORIZONTAL}px`,
          maxWidth: '800px',
          margin: '0 auto',
        }}
      >
        <div 
          className="text-content" 
          style={{ 
            whiteSpace: "pre-wrap",
            fontSize: `${fontSize}px`,
            lineHeight: lineHeight,
            color: textColor,
            fontFamily: "Georgia, \"Times New Roman\", serif",
          }}
        >
          {text}
        </div>
      </div>
      <style jsx>{`
        .text-content {
          font-family: Georgia, "Times New Roman", serif;
        }
      `}</style>
    </div>
  );
});
