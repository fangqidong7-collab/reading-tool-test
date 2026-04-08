"use client";

import React, { useMemo, useCallback, useRef, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProcessedContent } from "@/hooks/useBookshelf";

// Layout constants
const HEADER_HEIGHT = 56; // Fixed header height in px
const PAGINATION_HEIGHT = 56; // Fixed pagination bar height in px
const READING_PADDING_VERTICAL = 20; // Vertical padding in px
const READING_PADDING_HORIZONTAL = 32; // Horizontal padding in px
const PARAGRAPH_GAP = 16; // Gap between paragraphs in px
const MOBILE_BREAKPOINT = 768; // Mobile breakpoint in px

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

// Memoized paragraph component
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
    <p key={pIndex} className="paragraph">
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
}

export function ReadingArea({
  text,
  processedContent,
  onWordClick,
  getWordAnnotation,
  isClickable,
  currentPage = 1,
  onPageChange,
  fontSize = 18,
  lineHeight = 1.8,
  textColor = "#333333",
  backgroundColor = "#FFF8F0",
  annotationColor = "#E74C3C",
  annotationFontSize = 13,
  highlightBg = "#FFF3CD",
  highlightBgHover = "#FFE69C",
  isDarkMode = false,
}: ReadingAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [currentPageState, setCurrentPageState] = useState(currentPage || 1);
  const [totalPagesState, setTotalPagesState] = useState(1);

  // Get paragraph text content for height estimation
  const getParagraphText = useCallback((index: number): string => {
    if (!processedContent || !processedContent[index]) return "";
    return processedContent[index]
      .filter(s => s.type === "word")
      .map(s => s.text)
      .join(" ");
  }, [processedContent]);

  // Calculate pages based on viewport height and content
  const { pages, totalPages } = useMemo(() => {
    if (!processedContent || processedContent.length === 0) {
      return { pages: [[]], totalPages: 1 };
    }

    // Get viewport info
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;
    const isMobile = typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT;
    
    // Calculate available content height
    const availableHeight = viewportHeight - HEADER_HEIGHT - PAGINATION_HEIGHT - READING_PADDING_VERTICAL;
    
    // Container width for estimating chars per line
    const containerWidth = isMobile ? window.innerWidth - READING_PADDING_HORIZONTAL * 2 : 800 - READING_PADDING_HORIZONTAL * 2;

    // Estimate chars per line based on font size
    // Using 0.5 as the ratio for proportional fonts (average character width relative to font size)
    const charsPerLine = Math.floor(containerWidth / (fontSize * 0.5));

    // Calculate estimated height for each paragraph
    const paragraphHeights: number[] = [];
    for (let i = 0; i < processedContent.length; i++) {
      const paragraphText = getParagraphText(i);
      const textLength = paragraphText.length;
      
      // Calculate number of lines for this paragraph
      const lines = Math.max(1, Math.ceil(textLength / charsPerLine));
      
      // Calculate height: lines * lineHeight (in em) * fontSize + paragraph gap
      const height = lines * lineHeight * fontSize + PARAGRAPH_GAP;
      paragraphHeights.push(height);
    }

    // Calculate page breaks
    const pages: number[][] = [];
    let currentPageParagraphs: number[] = [];
    let currentPageHeight = 0;

    for (let i = 0; i < processedContent.length; i++) {
      const paraHeight = paragraphHeights[i];

      // If this paragraph alone exceeds available height, it gets its own page
      if (paraHeight > availableHeight) {
        // First, push current page if it has content
        if (currentPageParagraphs.length > 0) {
          pages.push(currentPageParagraphs);
          currentPageParagraphs = [];
          currentPageHeight = 0;
        }
        // Then add the oversized paragraph as a single-page
        pages.push([i]);
        continue;
      }

      // Check if adding this paragraph would exceed the page
      if (currentPageHeight + paraHeight <= availableHeight) {
        // Add to current page
        currentPageParagraphs.push(i);
        currentPageHeight += paraHeight;
      } else {
        // Start a new page
        if (currentPageParagraphs.length > 0) {
          pages.push(currentPageParagraphs);
        }
        currentPageParagraphs = [i];
        currentPageHeight = paraHeight;
      }
    }

    // Push the last page
    if (currentPageParagraphs.length > 0) {
      pages.push(currentPageParagraphs);
    }

    // Ensure at least one page
    if (pages.length === 0) {
      pages.push([0]);
    }

    const computedTotalPages = pages.length;
    
    // Debug output
    console.log('分页完成：共', computedTotalPages, '页，总段落数', processedContent.length);

    return { pages, totalPages: computedTotalPages };
  }, [processedContent, fontSize, lineHeight, getParagraphText]);

  // Update state when props change
  useEffect(() => {
    setTotalPagesState(totalPages);
  }, [totalPages]);

  useEffect(() => {
    if (currentPage && currentPage !== currentPageState) {
      setCurrentPageState(currentPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // Clamp current page to valid range
  const safeCurrentPage = Math.min(Math.max(1, currentPageState), totalPagesState);

  // Get paragraphs for current page
  const visibleParagraphs = useMemo(() => {
    if (pages.length === 0) return [];
    const pageIndex = Math.min(safeCurrentPage - 1, pages.length - 1);
    const paragraphIndices = pages[pageIndex] || [];
    return paragraphIndices.map((pIndex) => ({
      paragraph: processedContent![pIndex],
      pIndex,
    }));
  }, [pages, safeCurrentPage, processedContent]);

  // Handle page navigation
  const goToPrevPage = useCallback(() => {
    if (safeCurrentPage > 1) {
      const newPage = safeCurrentPage - 1;
      setCurrentPageState(newPage);
      if (onPageChange) {
        onPageChange(newPage);
      }
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [safeCurrentPage, onPageChange]);

  const goToNextPage = useCallback(() => {
    if (safeCurrentPage < totalPagesState) {
      const newPage = safeCurrentPage + 1;
      setCurrentPageState(newPage);
      if (onPageChange) {
        onPageChange(newPage);
      }
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [safeCurrentPage, totalPagesState, onPageChange]);

  // Render content with pagination
  if (processedContent && processedContent.length > 0) {
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
        {/* Reading Content Area - Takes remaining space */}
        <div 
          ref={containerRef}
          className="reading-area"
          style={{
            flex: 1,
            padding: `${READING_PADDING_VERTICAL}px ${READING_PADDING_HORIZONTAL}px`,
            maxWidth: '800px',
            margin: '0 auto',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div 
            ref={contentRef}
            className="text-content"
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: lineHeight,
              color: textColor,
              fontFamily: 'Georgia, "Times New Roman", serif',
              textAlign: 'justify',
            }}
          >
            {visibleParagraphs.map(({ paragraph, pIndex }) => (
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
              title="上一页"
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
              title="下一页"
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
}
