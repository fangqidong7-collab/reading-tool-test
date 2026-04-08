"use client";

import React, { useMemo, useCallback, useRef, useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProcessedContent } from "@/hooks/useBookshelf";

// Layout constants
const HEADER_HEIGHT = 56; // Fixed header height in px
const MOBILE_HEADER_HEIGHT = 48; // Mobile header height in px
const PAGINATION_HEIGHT = 56; // Fixed pagination bar height in px
const MOBILE_PAGINATION_HEIGHT = 0; // Mobile has no pagination bar (uses indicator)
const READING_PADDING_VERTICAL = 40; // Vertical padding in px
const MOBILE_READING_PADDING_VERTICAL = 16; // Mobile vertical padding
const READING_PADDING_HORIZONTAL = 32; // Horizontal padding in px
const MOBILE_READING_PADDING_HORIZONTAL = 12; // Mobile horizontal padding
const PARAGRAPH_GAP = 16; // Gap between paragraphs in px
const MOBILE_BREAKPOINT = 768; // Mobile breakpoint in px
const TOUCH_SWIPE_THRESHOLD = 50; // Minimum swipe distance in px
// Mobile page indicator constants
const MOBILE_TOP_GAP = 5; // 顶部间距
const MOBILE_BOTTOM_SAFE_ZONE = 60; // 底部页码安全区

// Ref type for exposing jumpToParagraph
export interface ReadingAreaRef {
  jumpToParagraph: (paragraphIndex: number) => void;
  jumpToSearchResult: (result: { paragraphIndex: number; charIndex: number }) => void;
}

// Memoized paragraph component with event delegation
type Annotations = Record<string, { root: string; meaning: string; pos: string; count: number }>;

const Paragraph = React.memo(({
  paragraph,
  pIndex,
  onWordClick,
  annotations,
  annotationColor = "#E74C3C",
}: {
  paragraph: ProcessedContent[number];
  pIndex: number;
  onWordClick: (word: string, lemma: string, event: React.MouseEvent) => void;
  annotations?: Annotations;
  annotationColor?: string;
}) => {
  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('word')) {
      const word = target.dataset.word || '';
      const lemma = target.dataset.lemma || '';
      onWordClick(word, lemma, e);
    }
  }, [onWordClick]);

  return (
    <p 
      className="paragraph"
      data-paragraph-index={pIndex}
      onClick={handleClick}
    >
      {paragraph.map((segment, sIndex) => {
        const key = `${pIndex}-${sIndex}`;
        if (segment.type === "space" || segment.type === "punctuation") {
          return <span key={key}>{segment.text}</span>;
        }
        
        // Word segment - check if annotated
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

// Custom comparison function to ensure re-render when annotations change
function paragraphPropsAreEqual(
  prev: {
    paragraph: ProcessedContent[number];
    pIndex: number;
    onWordClick: (word: string, lemma: string, event: React.MouseEvent) => void;
    annotations?: Annotations;
    annotationColor?: string;
  },
  next: {
    paragraph: ProcessedContent[number];
    pIndex: number;
    onWordClick: (word: string, lemma: string, event: React.MouseEvent) => void;
    annotations?: Annotations;
    annotationColor?: string;
  }
) {
  // Always re-render if paragraph index changes
  if (prev.pIndex !== next.pIndex) return false;
  
  // Always re-render if onWordClick changes
  if (prev.onWordClick !== next.onWordClick) return false;
  
  // Always re-render if annotation color changes
  if (prev.annotationColor !== next.annotationColor) return false;
  
  // Check if annotations have changed by comparing keys
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
  // Settings
  fontSize?: number;
  lineHeight?: number;
  textColor?: string;
  backgroundColor?: string;
  annotationColor?: string;
  annotationFontSize?: number;
  highlightBg?: string;
  highlightBgHover?: string;
  isDarkMode?: boolean;
  // External control states
  headerVisible?: boolean;
  // Search props
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
  annotationFontSize = 13,
  highlightBg = "#FFF3CD",
  highlightBgHover = "#FFE69C",
  isDarkMode = false,
  headerVisible = true,
  searchQuery = "",
  searchResults = [],
  currentSearchIndex = 0,
}: ReadingAreaProps, ref: React.Ref<ReadingAreaRef>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  const [currentPageState, setCurrentPageState] = useState(currentPage || 1);
  const [totalPagesState, setTotalPagesState] = useState(1);
  
  // Touch tracking refs
  const touchStartXRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);

  // Detect mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT;
  const currentHeaderHeight = isMobile ? MOBILE_HEADER_HEIGHT : HEADER_HEIGHT;
  const currentPaginationHeight = isMobile ? MOBILE_PAGINATION_HEIGHT : PAGINATION_HEIGHT;

  // 【修正】计算移动端阅读区域可用高度
  // 公式：100% - 顶栏(48px) - 顶部间距(5px) - 底部安全区(60px)
  const availableHeight = isMobile
    ? window.innerHeight - currentHeaderHeight - MOBILE_TOP_GAP - MOBILE_BOTTOM_SAFE_ZONE
    : window.innerHeight - currentHeaderHeight - currentPaginationHeight;

  // 每页高度 = Math.floor(阅读区域可用高度 / 行高) * 行高，保证无半截字
  const lineHeightPx = fontSize * lineHeight;
  const pageHeight = Math.floor(availableHeight / lineHeightPx) * lineHeightPx;
  const viewHeight = Math.max(lineHeightPx, pageHeight);

  // Calculate view height (recalculated on resize)
  useEffect(() => {
    // viewHeight is now calculated from pageHeight which is already line-aligned
  }, [fontSize, lineHeight]);

  // Calculate total pages based on content height
  useEffect(() => {
    if (!contentRef.current) return;
    
    const calculatePages = () => {
      const contentHeight = contentRef.current?.scrollHeight || 0;
      // 每页高度 = Math.floor(阅读区域可用高度 / 行高) * 行高
      const calcAvailableHeight = isMobile
        ? window.innerHeight - currentHeaderHeight - MOBILE_TOP_GAP - MOBILE_BOTTOM_SAFE_ZONE
        : window.innerHeight - currentHeaderHeight - currentPaginationHeight;
      const calcPageHeight = Math.floor(calcAvailableHeight / lineHeightPx) * lineHeightPx;
      const total = Math.ceil(contentHeight / calcPageHeight) || 1;
      setTotalPagesState(total);
      
      if (onTotalPagesChange) {
        onTotalPagesChange(total);
      }
    };
    
    // Small delay to ensure content is rendered
    const timer = setTimeout(calculatePages, 100);
    
    // Also recalculate on font/size changes
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(timer);
      calculatePages();
    });
    
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }
    
    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, [processedContent, fontSize, lineHeight, lineHeightPx, onTotalPagesChange, currentHeaderHeight, currentPaginationHeight]);

  // Update state when props change
  useEffect(() => {
    if (currentPage && currentPage !== currentPageState) {
      setCurrentPageState(currentPage);
    }
  }, [currentPage]);

  // Clamp current page to valid range
  const safeCurrentPage = Math.min(Math.max(1, currentPageState), totalPagesState);

  // 【修正二】分页偏移量：严格按行高整数倍计算
  // 首页 marginTop=0，后续页按行高整数倍偏移
  const offset = (safeCurrentPage - 1) * pageHeight;

  // Handle page navigation
  const goToPrevPage = useCallback(() => {
    if (safeCurrentPage > 1) {
      const newPage = safeCurrentPage - 1;
      setCurrentPageState(newPage);
      if (onPageChange) {
        onPageChange(newPage);
      }
    }
  }, [safeCurrentPage, onPageChange]);

  const goToNextPage = useCallback(() => {
    if (safeCurrentPage < totalPagesState) {
      const newPage = safeCurrentPage + 1;
      setCurrentPageState(newPage);
      if (onPageChange) {
        onPageChange(newPage);
      }
    }
  }, [safeCurrentPage, totalPagesState, onPageChange]);

  // Jump to specific page based on paragraph index
  const jumpToParagraph = useCallback((paragraphIndex: number) => {
    if (!contentRef.current) return;
    
    const element = contentRef.current.querySelector(`[data-paragraph-index="${paragraphIndex}"]`);
    if (element) {
      const offsetTop = (element as HTMLElement).offsetTop;
      const targetPage = Math.floor(offsetTop / pageHeight) + 1;
      const clampedPage = Math.min(Math.max(1, targetPage), totalPagesState);
      setCurrentPageState(clampedPage);
      if (onPageChange) {
        onPageChange(clampedPage);
      }
    }
  }, [pageHeight, totalPagesState, onPageChange]);

  // Expose jumpToParagraph via ref
  useImperativeHandle(ref, () => ({
    jumpToParagraph: jumpToParagraph,
    jumpToSearchResult: (result: { paragraphIndex: number; charIndex: number }) => {
      // Jump to the paragraph's page first
      jumpToParagraph(result.paragraphIndex);
      
      // Then scroll to the character position within the paragraph
      setTimeout(() => {
        if (!contentRef.current) return;
        const paraEl = contentRef.current.querySelector(`[data-paragraph-index="${result.paragraphIndex}"]`);
        if (paraEl) {
          // Simple scroll into view
          paraEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    },
  }));

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle keyboard when typing in inputs or modals are open
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Check if tooltip or settings panel is open
      const tooltip = document.querySelector('.word-tooltip, .tooltip');
      const settingsPanel = document.querySelector('.settings-panel');
      if (tooltip || settingsPanel) {
        return;
      }

      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        goToNextPage();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevPage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNextPage, goToPrevPage]);

  // Touch event handlers for mobile swipe
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const deltaX = touchEndX - touchStartXRef.current;
    const deltaY = touchEndY - touchStartYRef.current;
    
    // Check if it's a horizontal swipe (more horizontal than vertical)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > TOUCH_SWIPE_THRESHOLD) {
      if (deltaX < 0) {
        goToNextPage();
      } else {
        goToPrevPage();
      }
    } else if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
      // It's a tap, handle tap zones
      const screenWidth = window.innerWidth;
      if (touchEndX < screenWidth / 3) {
        goToPrevPage();
      } else if (touchEndX > screenWidth * 2 / 3) {
        goToNextPage();
      }
    }
  }, [goToNextPage, goToPrevPage]);

  // Render content with all paragraphs
  if (processedContent && processedContent.length > 0) {
    // 阅读区域高度：calc(100% - 48px - 5px - 60px)
    const currentHorizPadding = isMobile ? MOBILE_READING_PADDING_HORIZONTAL : READING_PADDING_HORIZONTAL;
    const containerHeight = headerVisible 
      ? `calc(100% - ${currentHeaderHeight}px - ${MOBILE_TOP_GAP}px - ${MOBILE_BOTTOM_SAFE_ZONE}px)` 
      : `calc(100% - ${MOBILE_BOTTOM_SAFE_ZONE}px)`;
    
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
        {/* 阅读区域 - 高度锁定，overflow: hidden */}
        <div 
          ref={containerRef}
          className="reading-area"
          style={{
            height: containerHeight,
            maxHeight: containerHeight,
            overflow: "hidden",
            paddingLeft: `${currentHorizPadding}px`,
            paddingRight: `${currentHorizPadding}px`,
            paddingTop: `${MOBILE_TOP_GAP}px`,
            paddingBottom: "20px",
            boxSizing: "border-box",
            flex: 1,
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* text-content - marginTop翻页 */}
          <div 
            ref={contentRef}
            className="text-content"
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: lineHeight,
              color: textColor,
              fontFamily: "Georgia, \"Times New Roman\", serif",
              textAlign: "justify",
              marginTop: safeCurrentPage === 1 ? "0px" : `-${offset}px`,
              willChange: "margin-top",
              minHeight: `${viewHeight}px`,
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
              />
            ))}
          </div>
        </div>

        {/* Pagination Bar - Fixed at bottom (PC only) */}
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
              title="上一页 (←)"
            >
              <ChevronLeft size={18} />
              <span>上一页</span>
            </button>

            <div className={`pagination-info ${isDarkMode ? 'dark' : ''}`}>
              <span>第 {safeCurrentPage} / {totalPagesState} 页</span>
            </div>

            <button
              className={`pagination-btn ${isDarkMode ? 'dark' : ''}`}
              onClick={goToNextPage}
              disabled={safeCurrentPage >= totalPagesState}
              title="下一页 (→)"
            >
              <span>下一页</span>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Mobile Page Indicator - Fixed at viewport bottom, next to N button */}
        <div className={`mobile-page-indicator ${isDarkMode ? 'dark' : ''}`}>
          {safeCurrentPage}/{totalPagesState}
        </div>

        <style jsx>{`
          .reading-wrapper {
            min-height: 100vh;
            position: relative;
          }

          .reading-area {
            box-sizing: border-box;
            position: relative;
          }

          .text-content {
            box-sizing: border-box;
            max-width: 800px;
            margin: 0 auto;
          }

          .text-content :global(.paragraph) {
            margin-bottom: ${PARAGRAPH_GAP}px;
          }

          .text-content :global(.word) {
            cursor: pointer;
            transition: color 0.15s;
          }

          .text-content :global(.word:hover) {
            color: #4A90D9;
          }

          .text-content :global(.search-highlight) {
            background-color: #FFEB3B;
            padding: 1px 2px;
            border-radius: 2px;
          }

          .text-content :global(.search-highlight-current) {
            background-color: #FF9800;
            color: #fff;
            padding: 1px 2px;
            border-radius: 2px;
          }

          .pagination-bar {
            border-top: 1px solid;
            flex-shrink: 0;
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
            background: #2a2a3e;
            border-color: #444;
            color: #ccc;
          }

          .pagination-btn:hover:not(:disabled) {
            background: #f5f5f5;
            border-color: #ccc;
          }

          .pagination-btn.dark:hover:not(:disabled) {
            background: #3a3a4e;
            border-color: #555;
          }

          .pagination-btn:disabled {
            opacity: 0.4;
            cursor: not-allowed;
          }

          .pagination-info {
            font-size: 14px;
            color: #666;
            min-width: 100px;
            text-align: center;
          }

          .pagination-info.dark {
            color: #999;
          }

          @media (max-width: 768px) {
            .reading-wrapper {
              min-height: 100dvh !important;
              height: 100dvh !important;
            }

            .reading-area {
              /* padding 由内联样式控制，保持一致 */
              overflow: hidden !important;
            }
          }

          /* Mobile Page Indicator - Fixed at viewport bottom */
          .mobile-page-indicator {
            display: none;
            position: fixed;
            bottom: 16px;
            right: 16px;
            font-size: 12px;
            color: #666666;
            background: rgba(255, 255, 255, 0.9);
            border-radius: 12px;
            padding: 6px 12px;
            z-index: 100;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          }

          .mobile-page-indicator.dark {
            background: rgba(30, 30, 46, 0.9);
            color: #aaaaaa;
          }

          @media (max-width: 768px) {
            .pagination-bar {
              display: none !important;
            }

            .mobile-page-indicator {
              display: block;
            }

            .text-content {
              padding-bottom: 60px !important; /* Space for page indicator */
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

  // Fallback: plain text
  return (
    <div className="reading-wrapper" style={{ backgroundColor, minHeight: '100vh' }}>
      <div 
        className="reading-area"
        style={{
          padding: `${READING_PADDING_VERTICAL}px ${READING_PADDING_HORIZONTAL}px`,
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
