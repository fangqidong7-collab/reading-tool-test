"use client";

import React, { useMemo, useCallback, memo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProcessedContent } from "@/hooks/useBookshelf";

// Pagination configuration
const PARAGRAPHS_PER_PAGE = 30;

// Memoized segment component - simpler rendering
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
          style={{ 
            color: '#E74C3C', 
            fontSize: '0.7em', 
            fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
            fontWeight: 'normal',
            marginLeft: '1px',
            marginRight: '1px'
          }}
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
}: ReadingAreaProps) {
  // Calculate total pages based on content
  const computedTotalPages = useMemo(() => {
    if (!processedContent || processedContent.length === 0) return 1;
    return Math.max(1, Math.ceil(processedContent.length / PARAGRAPHS_PER_PAGE));
  }, [processedContent]);

  // Use computed total pages if not provided
  const actualTotalPages = totalPages > 0 ? totalPages : computedTotalPages;

  // Get paragraphs for current page
  const visibleParagraphs = useMemo(() => {
    if (!processedContent || processedContent.length === 0) return [];
    const startIndex = (currentPage - 1) * PARAGRAPHS_PER_PAGE;
    const endIndex = Math.min(startIndex + PARAGRAPHS_PER_PAGE, processedContent.length);
    return processedContent.slice(startIndex, endIndex).map((p, i) => ({ 
      paragraph: p, 
      pIndex: startIndex + i 
    }));
  }, [processedContent, currentPage]);

  // Handle page navigation
  const goToPrevPage = useCallback(() => {
    if (currentPage > 1 && onPageChange) {
      onPageChange(currentPage - 1);
    }
  }, [currentPage, onPageChange]);

  const goToNextPage = useCallback(() => {
    if (currentPage < actualTotalPages && onPageChange) {
      onPageChange(currentPage + 1);
    }
  }, [currentPage, actualTotalPages, onPageChange]);

  // Render content with pagination
  if (processedContent && processedContent.length > 0) {
    return (
      <div className="reading-area">
        <div className="text-content">
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
        <div className="pagination-controls">
          <button 
            className="pagination-btn" 
            onClick={goToPrevPage}
            disabled={currentPage <= 1}
            title="上一页"
          >
            <ChevronLeft size={18} />
            <span>上一页</span>
          </button>
          
          <div className="pagination-info">
            <span>第 {currentPage} / {actualTotalPages} 页</span>
          </div>
          
          <button 
            className="pagination-btn" 
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
          }
          
          .reading-area .text-content {
            font-family: Georgia, "Times New Roman", serif;
            font-size: 18px;
            line-height: 1.8;
            color: #333;
            text-align: justify;
          }
          
          .reading-area .paragraph {
            margin-bottom: 1.2em;
          }
          
          .reading-area .whitespace {
            white-space: pre-wrap;
          }
          
          .reading-area .punctuation {
            color: #666;
          }
          
          .reading-area .word.clickable {
            cursor: pointer;
          }
          
          .reading-area .word.clickable:hover {
            color: #4A90D9;
          }
          
          .reading-area .annotated {
            cursor: pointer;
            background-color: #FFF3CD;
            padding: 1px 0;
            border-radius: 2px;
          }
          
          .reading-area .annotated:hover {
            background-color: #FFE69C;
          }
          
          .reading-area .annotation {
            color: #E74C3C !important;
            font-size: 0.7em !important;
            font-family: "Microsoft YaHei", "PingFang SC", sans-serif !important;
            font-weight: normal !important;
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
            margin-top: 2rem;
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
          
          .reading-area .pagination-btn:hover:not(:disabled) {
            background: #f5f5f5;
            border-color: #ccc;
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
        `}</style>
      </div>
    );
  }

  // Fallback: plain text
  return (
    <div className="reading-area">
      <div className="text-content" style={{ whiteSpace: "pre-wrap" }}>
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
