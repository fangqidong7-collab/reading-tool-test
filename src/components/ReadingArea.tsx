"use client";

import React, { useCallback, useRef, useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProcessedContent } from "@/hooks/useBookshelf";

// Layout constants
const HEADER_HEIGHT = 56;
const MOBILE_HEADER_HEIGHT = 48;
const PAGINATION_HEIGHT = 50;
const MOBILE_PAGINATION_HEIGHT = 0;
const READING_PADDING_HORIZONTAL = 32;
const MOBILE_READING_PADDING_HORIZONTAL = 12;
const PARAGRAPH_GAP = 16;
const MOBILE_BREAKPOINT = 768;
const TOUCH_SWIPE_THRESHOLD = 50;
const MOBILE_TOP_GAP = 5;
const MOBILE_BOTTOM_SAFE_ZONE = 60;

// Ref type
export interface ReadingAreaRef {
  jumpToParagraph: (paragraphIndex: number) => void;
  jumpToSearchResult: (result: { paragraphIndex: number; charIndex: number }) => void;
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
  currentPage?: number;
  onPageChange?: (page: number) => void;
  onTotalPagesChange?: (total: number) => void;
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
}

export const ReadingArea = forwardRef(function ReadingArea({
  text,
  processedContent,
  annotations,
  onWordClick,
  getWordAnnotation,
  isClickable,
  currentPage = 1,
  onPageChange,
  onTotalPagesChange,
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
}: ReadingAreaProps, ref: React.Ref<ReadingAreaRef>) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [currentPageState, setCurrentPageState] = useState(currentPage || 1);
  const [totalPagesState, setTotalPagesState] = useState(1);
  
  const touchStartXRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT;
  const currentHeaderHeight = isMobile ? MOBILE_HEADER_HEIGHT : HEADER_HEIGHT;
  const currentPaginationHeight = isMobile ? MOBILE_PAGINATION_HEIGHT : PAGINATION_HEIGHT;

  // 计算容器高度
  const containerHeight = isMobile
    ? window.innerHeight - currentHeaderHeight - MOBILE_TOP_GAP - MOBILE_BOTTOM_SAFE_ZONE
    : window.innerHeight - currentHeaderHeight - currentPaginationHeight;

  // 使用 CSS column 分页，计算总页数
  useEffect(() => {
    if (!containerRef.current) return;
    
    const calculatePages = () => {
      const container = containerRef.current;
      if (!container) return;
      
      const contentHeight = container.scrollHeight;
      const pageHeight = container.clientHeight;
      const total = Math.ceil(contentHeight / pageHeight) || 1;
      
      setTotalPagesState(total);
      if (onTotalPagesChange) {
        onTotalPagesChange(total);
      }
    };
    
    // 等待内容渲染
    const timer = setTimeout(calculatePages, 150);
    
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(timer);
      calculatePages();
    });
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, [processedContent, fontSize, lineHeight, onTotalPagesChange, containerHeight]);

  // 更新状态当 props 变化时
  useEffect(() => {
    if (currentPage && currentPage !== currentPageState) {
      setCurrentPageState(currentPage);
    }
  }, [currentPage]);

  const safeCurrentPage = Math.min(Math.max(1, currentPageState), totalPagesState);

  // 翻到指定页
  const goToPage = useCallback((page: number) => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const pageHeight = container.clientHeight;
    const scrollTop = (page - 1) * pageHeight;
    
    container.scrollTo({
      top: scrollTop,
      behavior: 'smooth'
    });
    
    setCurrentPageState(page);
    if (onPageChange) {
      onPageChange(page);
    }
  }, [onPageChange]);

  // 上一页
  const goToPrevPage = useCallback(() => {
    if (safeCurrentPage > 1) {
      goToPage(safeCurrentPage - 1);
    }
  }, [safeCurrentPage, goToPage]);

  // 下一页
  const goToNextPage = useCallback(() => {
    if (safeCurrentPage < totalPagesState) {
      goToPage(safeCurrentPage + 1);
    }
  }, [safeCurrentPage, totalPagesState, goToPage]);

  // 跳转到段落（目录跳转）
  const jumpToParagraph = useCallback((paragraphIndex: number) => {
    if (!containerRef.current) return;
    
    const element = containerRef.current.querySelector(`[data-paragraph-index="${paragraphIndex}"]`);
    if (element) {
      const container = containerRef.current;
      const pageHeight = container.clientHeight;
      const elementTop = (element as HTMLElement).offsetTop;
      const targetPage = Math.floor(elementTop / pageHeight) + 1;
      const clampedPage = Math.min(Math.max(1, targetPage), totalPagesState);
      goToPage(clampedPage);
    }
  }, [totalPagesState, goToPage]);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    jumpToParagraph,
    jumpToSearchResult: (result: { paragraphIndex: number; charIndex: number }) => {
      jumpToParagraph(result.paragraphIndex);
    },
  }));

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const tooltip = document.querySelector('.word-tooltip, .tooltip');
      const settingsPanel = document.querySelector('.settings-panel');
      if (tooltip || settingsPanel) {
        return;
      }

      if (e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        goToNextPage();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        goToPrevPage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNextPage, goToPrevPage]);

  // 触摸翻页
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const deltaX = touchEndX - touchStartXRef.current;
    const deltaY = touchEndY - touchStartYRef.current;
    
    // 垂直滑动翻页
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > TOUCH_SWIPE_THRESHOLD) {
      if (deltaY < 0) {
        goToNextPage();
      } else {
        goToPrevPage();
      }
    } else if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
      // 点击分区翻页
      const screenWidth = window.innerWidth;
      if (touchEndX < screenWidth / 3) {
        goToPrevPage();
      } else if (touchEndX > screenWidth * 2 / 3) {
        goToNextPage();
      }
    }
  }, [goToNextPage, goToPrevPage]);

  if (processedContent && processedContent.length > 0) {
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
        {/* 阅读容器 - CSS column 分页 */}
        <div 
          ref={containerRef}
          className="reading-container"
          style={{
            height: containerHeight,
            overflowY: "auto",
            overflowX: "hidden",
            paddingLeft: `${currentHorizPadding}px`,
            paddingRight: `${currentHorizPadding}px`,
            paddingTop: `${MOBILE_TOP_GAP}px`,
            paddingBottom: isMobile ? "0px" : `${PAGINATION_HEIGHT}px`,
            boxSizing: "border-box",
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="reader-content">
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

        {/* PC 端分页栏 */}
        {!isMobile && (
          <div
            className={`pagination-bar ${isDarkMode ? 'dark' : ''}`}
            style={{
              height: `${PAGINATION_HEIGHT}px`,
              backgroundColor,
              borderTopColor: isDarkMode ? "#333" : "#e0e0e0",
            }}
          >
            <div className="pagination-controls">
              <button
                className={`pagination-btn ${isDarkMode ? 'dark' : ''}`}
                onClick={goToPrevPage}
                disabled={safeCurrentPage <= 1}
                title="上一页 (↑)"
              >
                <ChevronLeft size={18} />
                <span>上一页</span>
              </button>

              <div className={`pagination-info ${isDarkMode ? 'dark' : ''}`}>
                <span>第 {safeCurrentPage} / {totalPagesState} 页 · {safeCurrentPage === totalPagesState ? 100 : Math.max(1, Math.round((safeCurrentPage / totalPagesState) * 100))}%</span>
              </div>

              <button
                className={`pagination-btn ${isDarkMode ? 'dark' : ''}`}
                onClick={goToNextPage}
                disabled={safeCurrentPage >= totalPagesState}
                title="下一页 (↓)"
              >
                <span>下一页</span>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* 移动端页码指示器 */}
        {isMobile && (
          <div className={`mobile-page-indicator ${isDarkMode ? 'dark' : ''}`}>
            {safeCurrentPage}/{totalPagesState} · {safeCurrentPage === totalPagesState ? 100 : Math.max(1, Math.round((safeCurrentPage / totalPagesState) * 100))}%
          </div>
        )}

        <style jsx>{`
          .reading-wrapper {
            min-height: 100vh;
            position: relative;
          }

          .reading-container {
            flex: 1;
            scroll-behavior: smooth;
            scrollbar-width: none;
            -ms-overflow-style: none;
          }

          .reading-container::-webkit-scrollbar {
            display: none;
          }

          .reader-content {
            font-size: ${fontSize}px;
            line-height: ${lineHeight};
            color: ${textColor};
            font-family: Georgia, "Times New Roman", serif;
            text-align: justify;
          }

          .reader-content :global(.paragraph) {
            margin-bottom: ${PARAGRAPH_GAP}px;
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

          .pagination-bar {
            border-top: 1px solid;
            flex-shrink: 0;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 50;
          }

          .pagination-controls {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 2rem;
            height: 100%;
            max-width: 600px;
            margin: 0 auto;
            padding: 0 1rem;
          }

          .pagination-btn {
            display: flex;
            align-items: center;
            gap: 0.25rem;
            padding: 0.5rem 1rem;
            border: 1px solid #ddd;
            border-radius: 6px;
            background: white;
            color: #333;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .pagination-btn.dark {
            background: #1a1a2e;
            border-color: #333;
            color: #ccc;
          }

          .pagination-btn:hover:not(:disabled) {
            background: #f5f5f5;
            border-color: #ccc;
          }

          .pagination-btn.dark:hover:not(:disabled) {
            background: #2a2a3e;
            border-color: #444;
          }

          .pagination-btn:disabled {
            opacity: 0.4;
            cursor: not-allowed;
          }

          .pagination-info {
            font-size: 14px;
            color: #666;
            min-width: 120px;
            text-align: center;
          }

          .pagination-info.dark {
            color: #ccc;
          }

          .mobile-page-indicator {
            position: fixed;
            bottom: 12px;
            right: 16px;
            font-size: 12px;
            color: #999;
            background: rgba(255, 255, 255, 0.8);
            border-radius: 12px;
            padding: 4px 10px;
            z-index: 100;
          }

          .mobile-page-indicator.dark {
            background: rgba(0, 0, 0, 0.5);
            color: #888;
          }

          @media (max-width: 768px) {
            .reading-wrapper {
              min-height: 100dvh !important;
              height: 100dvh !important;
            }

            .pagination-bar {
              display: none !important;
            }
          }

          @media (min-width: 769px) {
            .mobile-page-indicator {
              display: none;
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
