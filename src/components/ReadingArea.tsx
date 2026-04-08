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
  jumpToSearchResult: (result: { paragraphIndex: number; charIndex: number }) => void;
}

// Word info stored in data attributes for event delegation
interface WordInfo {
  word: string;
  lemma: string;
}

// Cached segment renderer - avoids recreating spans for already processed paragraphs
const paragraphCache = new Map<number, React.ReactNode>();

// Memoized paragraph component with event delegation
const Paragraph = React.memo(({
  paragraph,
  pIndex,
  onWordClick,
  searchHighlights,
  currentHighlightIndex,
}: {
  paragraph: ProcessedContent[number];
  pIndex: number;
  onWordClick: (word: string, lemma: string, event: React.MouseEvent) => void;
  searchHighlights?: Array<{ charIndex: number; length: number }>;
  currentHighlightIndex?: number;
}) => {
  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('word')) {
      const word = target.dataset.word || '';
      const lemma = target.dataset.lemma || '';
      onWordClick(word, lemma, e);
    }
  }, [onWordClick]);

  // Check if paragraph has search highlights
  const hasSearchHighlights = searchHighlights && searchHighlights.length > 0;

  return (
    <p 
      className="paragraph"
      data-paragraph-index={pIndex}
      onClick={handleClick}
    >
      {hasSearchHighlights ? (
        <HighlightedParagraph 
          text={paragraph} 
          highlights={searchHighlights} 
          currentIndex={currentHighlightIndex}
        />
      ) : (
        paragraph.map((segment, sIndex) => {
          const key = `${pIndex}-${sIndex}`;
          if (segment.type === "space" || segment.type === "punctuation") {
            return <span key={key}>{segment.text}</span>;
          }
          // Word segment
          return (
            <span 
              key={key} 
              className="word" 
              data-word={segment.text}
              data-lemma={segment.lemma}
            >
              {segment.text}
            </span>
          );
        })
      )}
    </p>
  );
});

Paragraph.displayName = "Paragraph";

// Render paragraph text with search highlights
function HighlightedParagraph({
  text,
  highlights,
  currentIndex
}: {
  text: ProcessedContent[number];
  highlights: Array<{ charIndex: number; length: number }>;
  currentIndex?: number;
}) {
  // Build plain text from segments for position calculation
  let plainText = '';
  const segmentEnds: number[] = [];
  text.forEach(segment => {
    const start = plainText.length;
    plainText += segment.text;
    segmentEnds.push(plainText.length);
  });

  // Build highlighted segments
  const elements: React.ReactNode[] = [];
  let lastEnd = 0;
  let currentHighlightIdx = 0;

  // Sort highlights by charIndex
  const sortedHighlights = [...highlights].sort((a, b) => a.charIndex - b.charIndex);

  for (const highlight of sortedHighlights) {
    // Find segments that fall within this highlight range
    let segStart = 0;
    for (let i = 0; i < segmentEnds.length; i++) {
      const segEnd = segmentEnds[i];
      if (segEnd > highlight.charIndex) {
        segStart = i;
        break;
      }
    }

    let segEnd = segmentEnds.length;
    for (let i = 0; i < segmentEnds.length; i++) {
      if (segmentEnds[i] >= highlight.charIndex + highlight.length) {
        segEnd = i + 1;
        break;
      }
    }

    // Add text before highlight
    for (let i = lastEnd; i < segStart; i++) {
      const segment = text[i];
      if (segment.type === "space" || segment.type === "punctuation") {
        elements.push(<span key={`p${i}`}>{segment.text}</span>);
      } else {
        elements.push(
          <span key={`p${i}`} className="word" data-word={segment.text} data-lemma={segment.lemma}>
            {segment.text}
          </span>
        );
      }
    }

    // Add highlighted text
    const isCurrentHighlight = currentHighlightIdx === currentIndex;
    for (let i = segStart; i < segEnd; i++) {
      const segment = text[i];
      if (segment.type === "space" || segment.type === "punctuation") {
        elements.push(
          <span key={`h${currentHighlightIdx}-${i}`} className={isCurrentHighlight ? "search-highlight-current" : "search-highlight"}>
            {segment.text}
          </span>
        );
      } else {
        elements.push(
          <span 
            key={`h${currentHighlightIdx}-${i}`} 
            className={`word ${isCurrentHighlight ? "search-highlight-current" : "search-highlight"}`}
            data-word={segment.text}
            data-lemma={segment.lemma}
          >
            {segment.text}
          </span>
        );
      }
    }

    lastEnd = segEnd;
    currentHighlightIdx++;
  }

  // Add remaining text
  for (let i = lastEnd; i < text.length; i++) {
    const segment = text[i];
    if (segment.type === "space" || segment.type === "punctuation") {
      elements.push(<span key={`e${i}`}>{segment.text}</span>);
    } else {
      elements.push(
        <span key={`e${i}`} className="word" data-word={segment.text} data-lemma={segment.lemma}>
          {segment.text}
        </span>
      );
    }
  }

  return <>{elements}</>;
}

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
  // External control states (to avoid state reset issues)
  headerVisible?: boolean;
  // Search props
  searchQuery?: string;
  searchResults?: Array<{ paragraphIndex: number; charIndex: number }>;
  currentSearchIndex?: number;
  onSearchResultClick?: (index: number) => void;
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
  searchQuery = "",
  searchResults = [],
  currentSearchIndex = 0,
  onSearchResultClick,
}: ReadingAreaProps, ref: React.Ref<ReadingAreaRef>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const paragraphHeightsRef = useRef<number[]>([]);
  const paragraphOffsetsRef = useRef<number[]>([]);
  
  const [currentPageState, setCurrentPageState] = useState(currentPage || 1);
  const [totalPagesState, setTotalPagesState] = useState(1);
  const [viewHeight, setViewHeight] = useState(600);
  const [pageParagraphs, setPageParagraphs] = useState<Map<number, number[]>>(new Map());
  
  // Touch tracking refs
  const touchStartXRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);

  // Annotation lookup cache
  const annotationCacheRef = useRef<Map<string, { root: string; meaning: string; pos: string; count: number } | null>>(new Map());

  // Calculate view height
  useEffect(() => {
    const calculateViewHeight = () => {
      const vh = window.innerHeight - HEADER_HEIGHT - PAGINATION_HEIGHT - (READING_PADDING_VERTICAL * 2);
      setViewHeight(Math.max(400, vh));
    };
    
    calculateViewHeight();
    window.addEventListener('resize', calculateViewHeight);
    return () => window.removeEventListener('resize', calculateViewHeight);
  }, []);

  // Calculate paragraph heights and offsets
  useEffect(() => {
    if (!processedContent || processedContent.length === 0) return;
    
    const measureParagraphs = () => {
      if (!contentRef.current) return;
      
      const paragraphElements = contentRef.current.querySelectorAll('.paragraph');
      const heights: number[] = [];
      const offsets: number[] = [];
      let currentOffset = 0;
      
      paragraphElements.forEach((el, index) => {
        const height = el.getBoundingClientRect().height + PARAGRAPH_GAP;
        heights[index] = height;
        offsets[index] = currentOffset;
        currentOffset += height;
      });
      
      paragraphHeightsRef.current = heights;
      paragraphOffsetsRef.current = offsets;
    };
    
    // Small delay to ensure DOM is ready
    const timer = setTimeout(measureParagraphs, 50);
    
    // Also measure on font/size changes
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(timer);
      measureParagraphs();
    });
    
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }
    
    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, [processedContent, fontSize, lineHeight]);

  // Calculate pages based on paragraph heights
  useEffect(() => {
    if (!processedContent || processedContent.length === 0) return;
    if (paragraphHeightsRef.current.length === 0) return;
    
    const calculatePages = () => {
      const totalContentHeight = paragraphOffsetsRef.current[paragraphOffsetsRef.current.length - 1] + 
        paragraphHeightsRef.current[paragraphHeightsRef.current.length - 1];
      const total = Math.ceil(totalContentHeight / viewHeight) || 1;
      
      // Calculate which paragraphs belong to which page
      const pages = new Map<number, number[]>();
      for (let page = 1; page <= total; page++) {
        const pageStart = (page - 1) * viewHeight;
        const pageEnd = page * viewHeight;
        const pageParagraphsList: number[] = [];
        
        paragraphOffsetsRef.current.forEach((offset, pIndex) => {
          const height = paragraphHeightsRef.current[pIndex];
          const paraEnd = offset + height;
          // Check if paragraph overlaps with this page
          if (paraEnd > pageStart && offset < pageEnd) {
            pageParagraphsList.push(pIndex);
          }
        });
        
        pages.set(page, pageParagraphsList);
      }
      
      setPageParagraphs(pages);
      setTotalPagesState(total);
      
      if (onTotalPagesChange) {
        onTotalPagesChange(total);
      }
    };
    
    calculatePages();
  }, [processedContent, viewHeight, onTotalPagesChange]);

  // Update state when props change
  useEffect(() => {
    if (currentPage && currentPage !== currentPageState) {
      setCurrentPageState(currentPage);
    }
  }, [currentPage]);

  // Clamp current page to valid range
  const safeCurrentPage = Math.min(Math.max(1, currentPageState), totalPagesState);

  // Get visible paragraphs for current page
  const visibleParagraphIndices = useMemo(() => {
    return pageParagraphs.get(safeCurrentPage) || [];
  }, [pageParagraphs, safeCurrentPage]);

  // Get search highlights for visible paragraphs
  const visibleSearchHighlights = useMemo(() => {
    if (!searchQuery || searchResults.length === 0) return new Map<number, Array<{ charIndex: number; length: number }>>();
    
    const highlights = new Map<number, Array<{ charIndex: number; length: number }>>();
    visibleParagraphIndices.forEach(pIndex => {
      const paraHighlights = searchResults.filter(r => r.paragraphIndex === pIndex);
      if (paraHighlights.length > 0) {
        highlights.set(pIndex, paraHighlights.map(r => ({
          charIndex: r.charIndex,
          length: searchQuery.length
        })));
      }
    });
    return highlights;
  }, [searchResults, searchQuery, visibleParagraphIndices]);

  // Get current search index for visible paragraphs
  const currentHighlightForVisible = useMemo(() => {
    if (currentSearchIndex < 0 || currentSearchIndex >= searchResults.length) return -1;
    const currentResult = searchResults[currentSearchIndex];
    if (!currentResult) return -1;
    return visibleParagraphIndices.indexOf(currentResult.paragraphIndex);
  }, [searchResults, currentSearchIndex, visibleParagraphIndices]);

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

  // Expose jumpToParagraph via ref
  useImperativeHandle(ref, () => ({
    jumpToParagraph: (paragraphIndex: number) => {
      if (!processedContent || processedContent.length === 0) return;
      
      // Calculate target page based on paragraph offset
      const offsets = paragraphOffsetsRef.current;
      const heights = paragraphHeightsRef.current;
      
      if (offsets.length === 0 || heights.length === 0) return;
      
      const targetOffset = offsets[paragraphIndex] || 0;
      const targetPage = Math.floor(targetOffset / viewHeight) + 1;
      const clampedPage = Math.min(Math.max(1, targetPage), totalPagesState);
      
      setCurrentPageState(clampedPage);
      if (onPageChange) {
        onPageChange(clampedPage);
      }
    },
    jumpToSearchResult: (result: { paragraphIndex: number; charIndex: number }) => {
      // First jump to the page containing this result
      const targetPage = Math.floor((paragraphOffsetsRef.current[result.paragraphIndex] || 0) / viewHeight) + 1;
      const clampedPage = Math.min(Math.max(1, targetPage), totalPagesState);
      
      setCurrentPageState(clampedPage);
      if (onPageChange) {
        onPageChange(clampedPage);
      }
      
      // After page changes, scroll to the result position
      setTimeout(() => {
        if (!contentRef.current) return;
        const paraEl = contentRef.current.querySelector(`[data-paragraph-index="${result.paragraphIndex}"]`);
        if (paraEl) {
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
    }
  }, [goToNextPage, goToPrevPage]);

  // Handle word click with event delegation
  const handleParagraphClick = useCallback((word: string, lemma: string, event: React.MouseEvent) => {
    onWordClick(word, lemma, event);
  }, [onWordClick]);

  // Render content with visible paragraphs only
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
        {/* Reading Content Area - visible paragraphs only */}
        <div 
          ref={containerRef}
          className="reading-area"
          style={{
            height: containerHeight,
            maxHeight: containerHeight,
            overflowY: 'auto',
            padding: `${READING_PADDING_VERTICAL}px ${READING_PADDING_HORIZONTAL}px`,
            boxSizing: 'border-box',
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Content container */}
          <div 
            ref={contentRef}
            className="text-content"
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: lineHeight,
              color: textColor,
              fontFamily: 'Georgia, "Times New Roman", serif',
              textAlign: 'justify',
              minHeight: `${viewHeight}px`,
            }}
          >
            {visibleParagraphIndices.map((pIndex) => (
              <Paragraph
                key={pIndex}
                paragraph={processedContent[pIndex]}
                pIndex={pIndex}
                onWordClick={handleParagraphClick}
                searchHighlights={visibleSearchHighlights.get(pIndex)}
                currentHighlightIndex={currentHighlightForVisible >= 0 && visibleSearchHighlights.get(pIndex) ? 
                  searchResults.findIndex(r => r.paragraphIndex === pIndex) : undefined}
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
            scroll-behavior: smooth;
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
