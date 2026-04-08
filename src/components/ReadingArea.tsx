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
  const currentHeaderHeight = isMobile ? MOBILE_HEADER_HEIGHT : HEADER_HEIGHT;
  const currentPaginationHeight = isMobile ? MOBILE_PAGINATION_HEIGHT : PAGINATION_HEIGHT;

  // Calculate line-aligned page height
  const lineHeightPx = fontSize * lineHeight;
  // Page bar height (mobile: fixed bar at bottom, PC: normal bar)
  const pageBarHeight = isMobile ? 40 : PAGINATION_HEIGHT;
  const rawViewHeight = window.innerHeight - currentHeaderHeight - pageBarHeight;
  const pageHeight = Math.floor(rawViewHeight / lineHeightPx) * lineHeightPx;
  const viewHeight = Math.max(200, pageHeight);

  // Calculate view height (recalculated on resize)
  useEffect(() => {
    // viewHeight is now calculated from pageHeight which is already line-aligned
  }, [fontSize, lineHeight]);

  // Calculate total pages based on content height
  useEffect(() => {
    if (!contentRef.current) return;
    
    const calculatePages = () => {
      const contentHeight = contentRef.current?.scrollHeight || 0;
      // Use pageHeight (line-aligned) for pagination
      const pageBarH = isMobile ? 40 : PAGINATION_HEIGHT;
      const pageHeight = Math.floor(
        (window.innerHeight - currentHeaderHeight - pageBarH) / lineHeightPx
      ) * lineHeightPx;
      const total = Math.ceil(contentHeight / pageHeight) || 1;
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

  // Calculate line-aligned page height for offset calculation
  const getPageHeight = () => {
    const pageBarH = isMobile ? 40 : PAGINATION_HEIGHT;
    return Math.floor(
      (window.innerHeight - currentHeaderHeight - pageBarH) / lineHeightPx
    ) * lineHeightPx;
  };

  // Calculate transform offset for current page (aligned to line height)
  // For page 1, offset = 0, so text starts at the top of padding area
  // For subsequent pages, offset = (page - 1) * pageHeight
  const currentPageHeight = getPageHeight();
  const offset = (safeCurrentPage - 1) * currentPageHeight;

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
      const pageHeight = getPageHeight();
      const targetPage = Math.floor(offsetTop / pageHeight) + 1;
      const clampedPage = Math.min(Math.max(1, targetPage), totalPagesState);
      setCurrentPageState(clampedPage);
      if (onPageChange) {
        onPageChange(clampedPage);
      }
    }
  }, [lineHeightPx, totalPagesState, onPageChange]);

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
    // Page indicator height (mobile uses fixed bar at bottom)
    const PAGE_BAR_HEIGHT = isMobile ? 40 : PAGINATION_HEIGHT;
    
    // Calculate reading area height: screen minus header minus page bar
    const readingAreaHeight = headerVisible 
      ? `calc(100vh - ${currentHeaderHeight}px - ${PAGE_BAR_HEIGHT}px)`
      : `calc(100vh - ${PAGE_BAR_HEIGHT}px)`;
    
    return (
      <div 
        className="reading-wrapper" 
        style={{ 
          backgroundColor,
          height: '100vh',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Reading Content Area - fills space between header and page bar */}
        <div 
          ref={containerRef}
          className="reading-area"
          style={{
            height: readingAreaHeight,
            overflow: 'hidden',
            paddingLeft: `${currentHorizPadding}px`,
            paddingRight: `${currentHorizPadding}px`,
            boxSizing: 'border-box',
            position: 'relative',
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Content container - position relative, no absolute */}
          <div 
            ref={contentRef}
            className="text-content"
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: lineHeight,
              color: textColor,
              fontFamily: 'Georgia, "Times New Roman", serif',
              textAlign: 'justify',
              marginTop: `-${offset}px`,
              willChange: 'margin-top',
              minHeight: `calc(100% - 40px)`,
              height: '100%',
              paddingTop: '20px',
              paddingBottom: '60px',
              boxSizing: 'border-box',
              display: 'block',
              flexShrink: 0,
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

        {/* Page indicator bar - PC: shown normally, Mobile: fixed at bottom */}
        <div
          className={`page-indicator-bar ${isDarkMode ? 'dark' : ''} ${isMobile ? 'mobile-fixed' : ''}`}
          style={{
            height: `${PAGE_BAR_HEIGHT}px`,
            backgroundColor,
            borderTopColor: isDarkMode ? "#333" : "#e0e0e0",
          }}
        >
          <div className="page-indicator-controls">
            <button
              className={`page-btn ${isDarkMode ? 'dark' : ''}`}
              onClick={goToPrevPage}
              disabled={safeCurrentPage <= 1}
            >
              <ChevronLeft size={20} />
            </button>
            <div className={`page-info ${isDarkMode ? 'dark' : ''}`}>
              {safeCurrentPage} / {totalPagesState}
            </div>
            <button
              className={`page-btn ${isDarkMode ? 'dark' : ''}`}
              onClick={goToNextPage}
              disabled={safeCurrentPage >= totalPagesState}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <style jsx>{`
          .reading-wrapper {
            height: 100vh;
            position: relative;
            overflow: hidden;
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

          /* Page indicator bar - fixed at bottom */
          .page-indicator-bar {
            border-top: 1px solid;
            flex-shrink: 0;
            position: relative;
          }

          .page-indicator-bar.mobile-fixed {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 100;
          }

          .page-indicator-controls {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100%;
            gap: 2rem;
          }

          .page-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            border: none;
            border-radius: 50%;
            background: rgba(200, 200, 200, 0.3);
            color: #333;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .page-btn.dark {
            background: rgba(80, 80, 80, 0.5);
            color: #ccc;
          }

          .page-btn:hover:not(:disabled) {
            background: rgba(200, 200, 200, 0.5);
          }

          .page-btn.dark:hover:not(:disabled) {
            background: rgba(100, 100, 100, 0.5);
          }

          .page-btn:disabled {
            opacity: 0.3;
            cursor: not-allowed;
          }

          .page-info {
            font-size: 14px;
            color: #666;
            min-width: 80px;
            text-align: center;
          }

          .page-info.dark {
            color: #999;
          }

          @media (max-width: 768px) {
            .reading-wrapper {
              height: 100vh !important;
            }

            .reading-area {
              padding: 0 12px !important;
            }
          }

          @media (min-width: 769px) {
            .page-indicator-bar.mobile-fixed {
              position: relative;
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
