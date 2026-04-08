"use client";

import React, { useMemo, useCallback, useRef, useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProcessedContent } from "@/hooks/useBookshelf";

// Layout constants
const HEADER_HEIGHT = 56; // Fixed header height in px
const MOBILE_HEADER_HEIGHT = 48; // Mobile header height in px
const PAGINATION_HEIGHT = 56; // Fixed pagination bar height in px
const MOBILE_PAGINATION_BAR_HEIGHT = 48; // Mobile fixed bottom bar height
const READING_PADDING_HORIZONTAL = 32; // Horizontal padding in px
const READING_PADDING_VERTICAL = 40; // Vertical padding in px
const MOBILE_READING_PADDING_HORIZONTAL = 12; // Mobile horizontal padding
const PARAGRAPH_GAP = 16; // Gap between paragraphs in px
const MOBILE_BREAKPOINT = 768; // Mobile breakpoint in px
const TOUCH_SWIPE_THRESHOLD = 50; // Minimum swipe distance in px
// Safe area bottom padding for iOS devices
const SAFE_AREA_BOTTOM = 34; // Default safe area, will be overridden by env() in CSS
const SAFE_AREA_TOP = 0; //刘海屏安全区

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
          <>
            <span 
              key={key} 
              className="word" 
              data-word={segment.text}
              data-lemma={lemma}
            >
              {segment.text}
            </span>
            {isAnnotated && (
              <span 
                key={`${key}-annotation`}
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
          </>
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

  // Calculate total pages based on content height
  useEffect(() => {
    if (!contentRef.current) return;
    
    const calculatePages = () => {
      // 获取正文内容区的高度（用于分页）
      const contentArea = document.querySelector('.reading-content-area') as HTMLElement;
      if (!contentArea) return;
      
      const contentHeight = contentRef.current?.scrollHeight || 0;
      const viewHeight = contentArea.clientHeight - 100; // 减去上下 padding
      const lineH = fontSize * lineHeight;
      // 每页显示的行数，向下取整
      const linesPerPage = Math.floor(viewHeight / lineH);
      const pageHeight = linesPerPage * lineH;
      const total = Math.ceil(contentHeight / pageHeight) || 1;
      setTotalPagesState(total);
      
      if (onTotalPagesChange) {
        onTotalPagesChange(total);
      }
    };
    
    // 延迟计算，确保内容已渲染
    const timer = setTimeout(calculatePages, 150);
    
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
  }, [processedContent, fontSize, lineHeight, onTotalPagesChange]);

  // Update state when props change
  useEffect(() => {
    if (currentPage && currentPage !== currentPageState) {
      setCurrentPageState(currentPage);
    }
  }, [currentPage]);

  // Clamp current page to valid range
  const safeCurrentPage = Math.min(Math.max(1, currentPageState), totalPagesState);

  // Handle page navigation
  const goToPrevPage = useCallback(() => {
    if (safeCurrentPage > 1) {
      const newPage = safeCurrentPage - 1;
      setCurrentPageState(newPage);
      if (onPageChange) {
        onPageChange(newPage);
      }
      // 滚动到对应位置
      scrollToPage(newPage);
    }
  }, [safeCurrentPage, onPageChange]);

  const goToNextPage = useCallback(() => {
    if (safeCurrentPage < totalPagesState) {
      const newPage = safeCurrentPage + 1;
      setCurrentPageState(newPage);
      if (onPageChange) {
        onPageChange(newPage);
      }
      // 滚动到对应位置
      scrollToPage(newPage);
    }
  }, [safeCurrentPage, totalPagesState, onPageChange]);

  // 滚动到指定页
  const scrollToPage = (pageNum: number) => {
    const contentArea = document.querySelector('.reading-content-area') as HTMLElement;
    if (!contentArea) return;
    
    const lineH = fontSize * lineHeight;
    const viewHeight = contentArea.clientHeight - 100;
    const linesPerPage = Math.floor(viewHeight / lineH);
    const pageHeight = linesPerPage * lineH;
    const scrollTop = (pageNum - 1) * pageHeight;
    
    contentArea.scrollTo({
      top: scrollTop,
      behavior: 'smooth'
    });
  };

  // Jump to specific page based on paragraph index
  const jumpToParagraph = useCallback((paragraphIndex: number) => {
    if (!contentRef.current) return;
    
    const element = contentRef.current.querySelector(`[data-paragraph-index="${paragraphIndex}"]`);
    if (element) {
      const contentArea = document.querySelector('.reading-content-area') as HTMLElement;
      if (!contentArea) return;
      
      const offsetTop = (element as HTMLElement).offsetTop;
      const lineH = fontSize * lineHeight;
      const viewHeight = contentArea.clientHeight - 100;
      const linesPerPage = Math.floor(viewHeight / lineH);
      const pageHeight = linesPerPage * lineH;
      const targetPage = Math.floor(offsetTop / pageHeight) + 1;
      const clampedPage = Math.min(Math.max(1, targetPage), totalPagesState);
      setCurrentPageState(clampedPage);
      if (onPageChange) {
        onPageChange(clampedPage);
      }
      scrollToPage(clampedPage);
    }
  }, [fontSize, lineHeight, totalPagesState, onPageChange]);

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
    const currentHorizPadding = isMobile ? MOBILE_READING_PADDING_HORIZONTAL : READING_PADDING_HORIZONTAL;
    const TOP_PADDING = 20; // 顶部安全间距
    const BOTTOM_PADDING = 80; // 底部安全间距，给页码栏留空间
    const PAGE_BAR_HEIGHT = 60; // 底部页码栏高度
    
    return (
      <div 
        className="reading-wrapper" 
        style={{ 
          backgroundColor,
          height: '100vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 中间正文区 - flex:1 自动填充空间，内容在此滚动 */}
        <div 
          ref={containerRef}
          className="reading-content-area"
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            paddingLeft: `${currentHorizPadding}px`,
            paddingRight: `${currentHorizPadding}px`,
            paddingTop: `${TOP_PADDING}px`,
            paddingBottom: `${BOTTOM_PADDING}px`,
            boxSizing: 'border-box',
            WebkitOverflowScrolling: 'touch',
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* 文本内容 - 高度等于所有段落总高度 */}
          <div 
            ref={contentRef}
            className="text-content"
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: lineHeight,
              color: textColor,
              fontFamily: 'Georgia, "Times New Roman", serif',
              textAlign: 'justify',
              maxWidth: '800px',
              margin: '0 auto',
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

        {/* 底部页码栏 - position:fixed 永远固定在屏幕最底部 */}
        <div
          className={`page-bar ${isDarkMode ? 'dark' : ''}`}
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: `${PAGE_BAR_HEIGHT}px`,
            backgroundColor,
            borderTop: '1px solid',
            borderTopColor: isDarkMode ? "#333" : "#e0e0e0",
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          <div className="page-bar-controls">
            <button
              className={`page-btn ${isDarkMode ? 'dark' : ''}`}
              onClick={goToPrevPage}
              disabled={safeCurrentPage <= 1}
            >
              <ChevronLeft size={22} />
            </button>
            <div className={`page-num ${isDarkMode ? 'dark' : ''}`}>
              {safeCurrentPage} / {totalPagesState}
            </div>
            <button
              className={`page-btn ${isDarkMode ? 'dark' : ''}`}
              onClick={goToNextPage}
              disabled={safeCurrentPage >= totalPagesState}
            >
              <ChevronRight size={22} />
            </button>
          </div>
        </div>

        <style jsx>{`
          .reading-wrapper {
            margin: 0 !important;
            padding: 0 !important;
          }

          .reading-content-area {
            -webkit-overflow-scrolling: touch;
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

          /* 底部页码栏 */
          .page-bar-controls {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 3rem;
            height: 100%;
          }

          .page-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 44px;
            height: 44px;
            border: none;
            border-radius: 50%;
            background: rgba(200, 200, 200, 0.4);
            color: #333;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .page-btn.dark {
            background: rgba(80, 80, 80, 0.5);
            color: #ccc;
          }

          .page-btn:hover:not(:disabled) {
            background: rgba(200, 200, 200, 0.6);
          }

          .page-btn.dark:hover:not(:disabled) {
            background: rgba(100, 100, 100, 0.6);
          }

          .page-btn:disabled {
            opacity: 0.3;
            cursor: not-allowed;
          }

          .page-num {
            font-size: 15px;
            color: #666;
            min-width: 80px;
            text-align: center;
          }

          .page-num.dark {
            color: #999;
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
