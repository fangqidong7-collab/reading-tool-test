"use client";

import React, { useMemo, useCallback, useRef, useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProcessedContent } from "@/hooks/useBookshelf";

// Layout constants
const HEADER_HEIGHT = 56; // Fixed header height in px
const PAGINATION_HEIGHT = 56; // Fixed pagination bar height in px
const READING_PADDING_VERTICAL = 40; // Vertical padding in px
const READING_PADDING_HORIZONTAL = 32; // Horizontal padding in px
const PARAGRAPH_GAP = 16; // Gap between paragraphs in px
const MOBILE_BREAKPOINT = 768; // Mobile breakpoint in px
const TOUCH_SWIPE_THRESHOLD = 50; // Minimum swipe distance in px

// Ref type for exposing jumpToParagraph
export interface ReadingAreaRef {
  jumpToParagraph: (paragraphIndex: number) => void;
}

// Memoized segment component
const Segment = React.memo(({
  segment,
  pIndex,
  sIndex,
  getWordAnnotation,
  isClickable,
  onWordClick,
}: {
  segment: ProcessedContent[number][number];
  pIndex: number;
  sIndex: number;
  getWordAnnotation: (word: string) => { root: string; meaning: string; pos: string; count: number } | null;
  isClickable: (word: string) => boolean;
  onWordClick: (word: string, event: React.MouseEvent) => void;
}) => {
  const key = `${pIndex}-${sIndex}`;
  
  if (segment.type === "space") {
    return <span key={key} className="whitespace">{segment.text}</span>;
  }
  
  if (segment.type === "punctuation") {
    return <span key={key} className="punctuation">{segment.text}</span>;
  }
  
  // Word segment
  const word = segment.text;
  const annotation = getWordAnnotation(word);
  const isAnnotated = !!annotation;
  
  if (isAnnotated) {
    return (
      <span key={key} className="annotated">
        {word}<span className="annotation">({annotation.meaning})</span>
      </span>
    );
  }
  
  if (isClickable(word)) {
    return (
      <span key={key} className="word clickable" onClick={(e) => onWordClick(word, e)}>
        {word}
      </span>
    );
  }
  
  return <span key={key}>{word}</span>;
});

Segment.displayName = "Segment";

// Memoized paragraph component with paragraph index data attribute
const Paragraph = React.memo(({
  paragraph,
  pIndex,
  onWordClick,
  getWordAnnotation,
  isClickable,
}: {
  paragraph: ProcessedContent[number];
  pIndex: number;
  onWordClick: (word: string, event: React.MouseEvent) => void;
  getWordAnnotation: (word: string) => { root: string; meaning: string; pos: string; count: number } | null;
  isClickable: (word: string) => boolean;
}) => {
  return (
    <p 
      key={pIndex} 
      className="paragraph"
      data-paragraph-index={pIndex}
    >
      {paragraph.map((segment, sIndex) => (
        <Segment
          key={`${pIndex}-${sIndex}`}
          segment={segment}
          pIndex={pIndex}
          sIndex={sIndex}
          getWordAnnotation={getWordAnnotation}
          isClickable={isClickable}
          onWordClick={onWordClick}
        />
      ))}
    </p>
  );
});

Paragraph.displayName = "Paragraph";

interface ReadingAreaProps {
  text: string;
  processedContent?: ProcessedContent | null;
  annotations?: Record<string, { root: string; meaning: string; pos: string; count: number }>;
  onWordClick: (word: string, event: React.MouseEvent) => void;
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
  // External control states (to avoid state reset issues)
  headerVisible?: boolean;
}

export const ReadingArea = forwardRef(function ReadingArea({
  text,
  processedContent,
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
}: ReadingAreaProps, ref: React.Ref<ReadingAreaRef>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [currentPageState, setCurrentPageState] = useState(currentPage || 1);
  const [totalPagesState, setTotalPagesState] = useState(1);
  const [viewHeight, setViewHeight] = useState(600);
  
  // Touch tracking refs
  const touchStartXRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);

  // Expose jumpToParagraph via ref
  useImperativeHandle(ref, () => ({
    jumpToParagraph: (paragraphIndex: number) => {
      const paragraphElements = contentRef.current?.querySelectorAll('[data-paragraph-index]');
      if (!paragraphElements || paragraphElements.length === 0) return;
      
      // Find the target paragraph element
      const targetElement = Array.from(paragraphElements).find(
        (el) => el.getAttribute('data-paragraph-index') === String(paragraphIndex)
      );
      
      if (!targetElement) return;
      
      // Calculate the offset top of the paragraph
      const offsetTop = targetElement.getBoundingClientRect().top + contentRef.current!.scrollTop;
      const currentTranslateY = parseFloat(contentRef.current?.style.transform.replace('translateY(', '').replace('px)', '') || '0');
      const newTranslateY = -offsetTop;
      
      // Update the transform
      if (contentRef.current) {
        contentRef.current.style.transform = `translateY(${newTranslateY}px)`;
        
        // Calculate new page based on the translateY value
        const newPage = Math.floor(Math.abs(newTranslateY) / viewHeight) + 1;
        setCurrentPageState(newPage);
        
        if (onPageChange) {
          onPageChange(newPage);
        }
      }
    },
  }));

  // Calculate available viewport height for content
  useEffect(() => {
    const calculateViewHeight = () => {
      const vh = window.innerHeight - HEADER_HEIGHT - PAGINATION_HEIGHT - (READING_PADDING_VERTICAL * 2);
      setViewHeight(Math.max(400, vh));
    };
    
    calculateViewHeight();
    window.addEventListener('resize', calculateViewHeight);
    return () => window.removeEventListener('resize', calculateViewHeight);
  }, []);

  // Calculate total pages based on content height
  useEffect(() => {
    if (!contentRef.current) return;
    
    const calculatePages = () => {
      const contentHeight = contentRef.current?.scrollHeight || 0;
      const total = Math.ceil(contentHeight / viewHeight) || 1;
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
  }, [processedContent, fontSize, lineHeight, viewHeight, onTotalPagesChange]);

  // Update state when props change (only for page changes, not for sidebar/header)
  useEffect(() => {
    if (currentPage && currentPage !== currentPageState) {
      setCurrentPageState(currentPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // Clamp current page to valid range
  const safeCurrentPage = Math.min(Math.max(1, currentPageState), totalPagesState);

  // Calculate transform offset for current page
  const offset = (safeCurrentPage - 1) * viewHeight;

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

  // Jump to a specific page based on paragraph index
  const jumpToParagraph = useCallback((paragraphIndex: number) => {
    if (!contentRef.current) return;
    
    const element = contentRef.current.querySelector(`[data-paragraph-index="${paragraphIndex}"]`);
    if (element) {
      const offsetTop = (element as HTMLElement).offsetTop;
      const targetPage = Math.floor(offsetTop / viewHeight) + 1;
      const clampedPage = Math.min(Math.max(1, targetPage), totalPagesState);
      setCurrentPageState(clampedPage);
      if (onPageChange) {
        onPageChange(clampedPage);
      }
    }
  }, [viewHeight, totalPagesState, onPageChange]);

  // Expose jump function via ref callback
  useEffect(() => {
    if (containerRef.current) {
      (containerRef.current as unknown as { jumpToParagraph: (index: number) => void }).jumpToParagraph = jumpToParagraph;
    }
  }, [jumpToParagraph]);

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

      // Check if tooltip or settings panel is open - disable keyboard paging
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
      // Horizontal swipe
      if (deltaX < 0) {
        // Swipe left - next page
        goToNextPage();
      } else {
        // Swipe right - prev page
        goToPrevPage();
      }
    } else if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
      // It's a tap, not a swipe - handle tap zones
      const screenWidth = window.innerWidth;
      if (touchEndX < screenWidth / 3) {
        // Left third - prev page
        goToPrevPage();
      } else if (touchEndX > screenWidth * 2 / 3) {
        // Right third - next page
        goToNextPage();
      }
      // Middle third - could toggle header visibility (not implemented for now)
    }
  }, [goToNextPage, goToPrevPage]);

  // Render content with CSS offset-based pagination
  if (processedContent && processedContent.length > 0) {
    const containerHeight = headerVisible ? `calc(100vh - ${HEADER_HEIGHT}px - ${PAGINATION_HEIGHT}px)` : `calc(100vh - ${PAGINATION_HEIGHT}px)`;
    
    return (
      <div 
        className="reading-wrapper" 
        style={{ 
          backgroundColor,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Reading Content Area - CSS offset pagination */}
        <div 
          ref={containerRef}
          className="reading-area"
          style={{
            height: containerHeight,
            maxHeight: containerHeight,
            overflow: 'hidden',
            padding: `${READING_PADDING_VERTICAL}px ${READING_PADDING_HORIZONTAL}px`,
            boxSizing: 'border-box',
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Scrolling content container with transform offset */}
          <div 
            ref={contentRef}
            className="text-content"
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: lineHeight,
              color: textColor,
              fontFamily: 'Georgia, "Times New Roman", serif',
              textAlign: 'justify',
              transform: `translateY(-${offset}px)`,
              willChange: 'transform',
              // Allow natural height but we'll clip with the parent
              minHeight: `${viewHeight}px`,
            }}
          >
            {processedContent.map((paragraph, pIndex) => (
              <Paragraph
                key={pIndex}
                paragraph={paragraph}
                pIndex={pIndex}
                onWordClick={onWordClick}
                getWordAnnotation={getWordAnnotation}
                isClickable={isClickable}
              />
            ))}
          </div>
        </div>

        {/* Pagination Bar - Fixed at bottom */}
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

        <style jsx>{`
          .reading-wrapper {
            min-height: 100vh;
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

          .text-content :global(.whitespace) {
            white-space: pre-wrap;
          }

          .text-content :global(.punctuation) {
            opacity: 0.7;
          }

          .text-content :global(.word.clickable) {
            cursor: pointer;
            transition: color 0.15s;
          }

          .text-content :global(.word.clickable:hover) {
            color: #4A90D9;
          }

          .text-content :global(.annotated) {
            cursor: pointer;
            background-color: ${highlightBg};
            padding: 1px 0;
            border-radius: 2px;
            transition: background-color 0.15s;
          }

          .text-content :global(.annotated:hover) {
            background-color: ${highlightBgHover};
          }

          .text-content :global(.annotation) {
            color: ${annotationColor};
            font-size: ${annotationFontSize}px;
            font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
            font-weight: normal;
            margin-left: 1px;
            margin-right: 1px;
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

          @media (max-width: ${MOBILE_BREAKPOINT}px) {
            .reading-area {
              padding: 16px !important;
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
