"use client";

import React, { useMemo, useCallback, useRef, useEffect, useState, memo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProcessedContent } from "@/hooks/useBookshelf";

// Layout constants
const READING_PADDING_TOP = 32; // padding-top in rem
const READING_PADDING_BOTTOM = 32; // padding-bottom in rem
const PARAGRAPH_MARGIN_BOTTOM = 1.2; // margin-bottom in em
const HEADER_HEIGHT = 64; // approximate header height in px
const PAGINATION_HEIGHT = 100; // approximate pagination controls height in px

// Memoized segment component
const Segment = memo(({
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
  annotationColor?: string;
  annotationFontSize?: number;
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
        {word}<span 
          className="annotation"
          data-annotation={annotation?.meaning}
        >({annotation.meaning})</span>
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
const Paragraph = memo(({
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
  totalPages?: number;
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
  totalPages = 1,
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
  const measureRef = useRef<HTMLDivElement>(null);
  const [paragraphHeights, setParagraphHeights] = useState<number[]>([]);

  // Calculate page breaks based on viewport height
  const { pages, computedTotalPages } = useMemo(() => {
    if (!processedContent || processedContent.length === 0) {
      return { pages: [[]], computedTotalPages: 1 };
    }

    // Get available height
    const availableHeight = typeof window !== "undefined"
      ? window.innerHeight - HEADER_HEIGHT - PAGINATION_HEIGHT - (READING_PADDING_TOP + READING_PADDING_BOTTOM) * 16
      : 600;

    // Calculate line height in pixels
    const lineHeightPx = fontSize * lineHeight;
    
    // Calculate paragraph margins
    const paragraphMarginPx = fontSize * PARAGRAPH_MARGIN_BOTTOM;

    // If we have measured heights, use them; otherwise estimate
    const getParagraphHeight = (index: number): number => {
      if (paragraphHeights[index] && paragraphHeights[index] > 0) {
        return paragraphHeights[index] + paragraphMarginPx;
      }
      // Estimate: paragraph has roughly 5-10 words per line, average 20 chars
      const paragraphText = processedContent[index]
        .filter(s => s.type === "word")
        .map(s => s.text)
        .join(" ");
      const charsPerLine = 40; // approximate chars per line at 18px font
      const lines = Math.max(1, Math.ceil(paragraphText.length / charsPerLine));
      return lines * lineHeightPx + paragraphMarginPx + 20; // add padding
    };

    // Calculate page breaks
    const pageBreaks: number[][] = [];
    let currentPageParagraphs: number[] = [];
    let currentPageHeight = 0;

    for (let i = 0; i < processedContent.length; i++) {
      const paraHeight = getParagraphHeight(i);

      // Check if adding this paragraph would exceed the page
      if (currentPageHeight + paraHeight > availableHeight && currentPageParagraphs.length > 0) {
        // Start a new page
        pageBreaks.push(currentPageParagraphs);
        currentPageParagraphs = [i];
        currentPageHeight = paraHeight;
      } else {
        currentPageParagraphs.push(i);
        currentPageHeight += paraHeight;
      }
    }

    // Add the last page
    if (currentPageParagraphs.length > 0) {
      pageBreaks.push(currentPageParagraphs);
    }

    // Ensure at least one page
    if (pageBreaks.length === 0) {
      pageBreaks.push([0]);
    }

    return {
      pages: pageBreaks,
      computedTotalPages: pageBreaks.length,
    };
  }, [processedContent, fontSize, lineHeight, paragraphHeights]);

  // Actual total pages
  const actualTotalPages = totalPages > 0 ? totalPages : computedTotalPages;

  // Get paragraphs for current page
  const visibleParagraphs = useMemo(() => {
    if (pages.length === 0) return [];
    const pageIndex = Math.min(currentPage - 1, pages.length - 1);
    const paragraphIndices = pages[pageIndex] || [];
    return paragraphIndices.map((pIndex) => ({
      paragraph: processedContent![pIndex],
      pIndex,
    }));
  }, [pages, currentPage, processedContent]);

  // Measure paragraph heights after render
  useEffect(() => {
    if (!measureRef.current || !processedContent) return;

    const newHeights: number[] = [...paragraphHeights];
    let hasChanges = false;

    const observer = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const index = parseInt((entry.target as HTMLElement).dataset.paraIndex || "0", 10);
        const height = entry.contentRect.height;
        if (newHeights[index] !== height) {
          newHeights[index] = height;
          hasChanges = true;
        }
      });

      if (hasChanges) {
        setParagraphHeights(newHeights);
      }
    });

    const elements = measureRef.current.querySelectorAll(".paragraph");
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [visibleParagraphs, processedContent, paragraphHeights]);

  // Handle page navigation
  const goToPrevPage = useCallback(() => {
    if (currentPage > 1 && onPageChange) {
      onPageChange(currentPage - 1);
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [currentPage, onPageChange]);

  const goToNextPage = useCallback(() => {
    if (currentPage < actualTotalPages && onPageChange) {
      onPageChange(currentPage + 1);
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [currentPage, actualTotalPages, onPageChange]);

  // Apply dynamic styles based on settings
  const textStyle = {
    fontSize: `${fontSize}px`,
    lineHeight: lineHeight,
    color: textColor,
    backgroundColor: backgroundColor,
  };

  // Render content with pagination
  if (processedContent && processedContent.length > 0) {
    return (
      <div className="reading-area" ref={containerRef} style={{ backgroundColor }}>
        {/* Hidden measurement container */}
        <div
          ref={measureRef}
          className="measure-container"
          style={{
            ...textStyle,
            position: "absolute",
            visibility: "hidden",
            pointerEvents: "none",
            width: "800px",
            maxWidth: "100%",
            padding: "2rem",
          }}
        />

        <div className="text-content" style={textStyle}>
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

        {/* Pagination Controls */}
        <div
          className="pagination-controls"
          style={{
            backgroundColor,
            borderTopColor: isDarkMode ? "#333" : "#e5e5e5",
          }}
        >
          <button
            className={`pagination-btn ${isDarkMode ? "dark" : ""}`}
            onClick={goToPrevPage}
            disabled={currentPage <= 1}
            title="上一页"
          >
            <ChevronLeft size={18} />
            <span>上一页</span>
          </button>

          <div className={`pagination-info ${isDarkMode ? "dark" : ""}`}>
            <span>第 {currentPage} / {actualTotalPages} 页</span>
          </div>

          <button
            className={`pagination-btn ${isDarkMode ? "dark" : ""}`}
            onClick={goToNextPage}
            disabled={currentPage >= actualTotalPages}
            title="下一页"
          >
            <span>下一页</span>
            <ChevronRight size={18} />
          </button>
        </div>

        <style>{`
          .reading-area {
            padding: 2rem;
            max-width: 800px;
            margin: 0 auto;
            min-height: calc(100vh - 64px);
            display: flex;
            flex-direction: column;
          }

          .reading-area .text-content {
            font-family: Georgia, "Times New Roman", serif;
            text-align: justify;
            flex: 1;
          }

          .reading-area .paragraph {
            margin-bottom: 1.2em;
          }

          .reading-area .whitespace {
            white-space: pre-wrap;
          }

          .reading-area .punctuation {
            opacity: 0.7;
          }

          .reading-area .word.clickable {
            cursor: pointer;
            transition: color 0.15s;
          }

          .reading-area .word.clickable:hover {
            color: #4A90D9;
          }

          .reading-area .annotated {
            cursor: pointer;
            background-color: ${highlightBg};
            padding: 1px 0;
            border-radius: 2px;
            transition: background-color 0.15s;
          }

          .reading-area .annotated:hover {
            background-color: ${highlightBgHover};
          }

          .reading-area .annotation {
            color: ${annotationColor};
            font-size: ${annotationFontSize}px;
            font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
            font-weight: normal;
            margin-left: 1px;
            margin-right: 1px;
          }

          .reading-area .pagination-controls {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 1.5rem;
            padding: 1.5rem 0;
            border-top: 1px solid #e5e5e5;
            margin-top: auto;
          }

          .reading-area .pagination-btn {
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

          .reading-area .pagination-btn.dark {
            background: #2a2a3e;
            border-color: #444;
            color: #ccc;
          }

          .reading-area .pagination-btn:hover:not(:disabled) {
            background: #f5f5f5;
            border-color: #ccc;
          }

          .reading-area .pagination-btn.dark:hover:not(:disabled) {
            background: #3a3a4e;
            border-color: #555;
          }

          .reading-area .pagination-btn:disabled {
            opacity: 0.4;
            cursor: not-allowed;
          }

          .reading-area .pagination-info {
            font-size: 14px;
            color: #666;
            min-width: 100px;
            text-align: center;
          }

          .reading-area .pagination-info.dark {
            color: #999;
          }
        `}</style>
      </div>
    );
  }

  // Fallback: plain text
  return (
    <div className="reading-area" style={{ backgroundColor }}>
      <div className="text-content" style={{ ...textStyle, whiteSpace: "pre-wrap" }}>
        {text}
      </div>
      <style>{`
        .reading-area {
          padding: 2rem;
          max-width: 800px;
          margin: 0 auto;
        }
        .reading-area .text-content {
          font-family: Georgia, "Times New Roman", serif;
          font-size: 18px;
          line-height: 1.8;
          color: #333;
        }
      `}</style>
    </div>
  );
}
