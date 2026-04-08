"use client";

import React, { useMemo, useRef, useState, useEffect, useCallback, memo } from "react";
import { ProcessedContent } from "@/hooks/useBookshelf";

// Virtual scroll configuration
const BUFFER_SIZE = 5; // Number of paragraphs to render above/below viewport
const ESTIMATED_PARAGRAPH_HEIGHT = 100; // Estimated height for each paragraph

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
  hasAnnotations?: boolean;
  onWordClick: (word: string, event: React.MouseEvent) => void;
  getWordAnnotation: (word: string) => { root: string; meaning: string; pos: string; count: number } | null;
  isClickable: (word: string) => boolean;
}) => {
  const handleClick = (word: string, event: React.MouseEvent) => {
    if (isClickable(word)) {
      onWordClick(word, event);
    }
  };

  return (
    <p key={pIndex} className="paragraph">
      {paragraph.map((segment, sIndex) => {
        const key = `${pIndex}-${sIndex}`;
        
        if (segment.type === "space") {
          return (
            <span key={key} className="whitespace">
              {segment.text}
            </span>
          );
        }
        
        if (segment.type === "punctuation") {
          return (
            <span key={key} className="punctuation">
              {segment.text}
            </span>
          );
        }
        
        // Word segment
        const word = segment.text;
        const root = segment.lemma;
        const annotation = getWordAnnotation(word);
        const isAnnotated = !!annotation;
        
        // 新格式：英文(中文)，中文在括号内显示
        return (
          <span
            key={key}
            className={`word ${isClickable(word) ? "clickable" : ""} ${
              isAnnotated ? "annotated" : ""
            }`}
            data-root={root}
            onClick={(e) => handleClick(word, e)}
          >
            <span className="word-text">{word}</span>
            {isAnnotated && (
              <span className="word-annotation">({annotation.meaning})</span>
            )}
          </span>
        );
      })}
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
}

export function ReadingArea({
  text,
  processedContent,
  onWordClick,
  getWordAnnotation,
  isClickable,
}: ReadingAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
  const [paragraphHeights, setParagraphHeights] = useState<Record<number, number>>({});

  // Calculate which paragraphs should be rendered
  const visibleParagraphs = useMemo(() => {
    if (!processedContent) return [];
    
    const totalParagraphs = processedContent.length;
    const start = Math.max(0, visibleRange.start - BUFFER_SIZE);
    const end = Math.min(totalParagraphs, visibleRange.end + BUFFER_SIZE);
    
    return processedContent.slice(start, end).map((paragraph, idx) => ({
      paragraph,
      pIndex: start + idx,
    }));
  }, [processedContent, visibleRange]);

  // Calculate total height for spacer
  const totalHeight = useMemo(() => {
    if (!processedContent) return 0;
    
    let height = 0;
    for (let i = 0; i < processedContent.length; i++) {
      height += paragraphHeights[i] || ESTIMATED_PARAGRAPH_HEIGHT;
    }
    return height;
  }, [processedContent, paragraphHeights]);

  // Calculate top spacer height
  const topSpacerHeight = useMemo(() => {
    if (!processedContent) return 0;
    
    let height = 0;
    for (let i = 0; i < visibleRange.start - BUFFER_SIZE; i++) {
      if (i >= 0) {
        height += paragraphHeights[i] || ESTIMATED_PARAGRAPH_HEIGHT;
      }
    }
    return Math.max(0, height);
  }, [processedContent, paragraphHeights, visibleRange.start]);

  // Handle scroll with throttling
  const handleScroll = useCallback(() => {
    if (!containerRef.current || !processedContent) return;
    
    const scrollTop = window.scrollY;
    const viewportHeight = window.innerHeight;
    const containerTop = containerRef.current.offsetTop || 0;
    
    // Calculate which paragraphs are visible
    let accumulatedHeight = 0;
    let startIndex = 0;
    let endIndex = processedContent.length;
    
    for (let i = 0; i < processedContent.length; i++) {
      const height = paragraphHeights[i] || ESTIMATED_PARAGRAPH_HEIGHT;
      
      if (accumulatedHeight + height >= scrollTop - containerTop - viewportHeight) {
        startIndex = i;
        break;
      }
      accumulatedHeight += height;
    }
    
    for (let i = startIndex; i < processedContent.length; i++) {
      const height = paragraphHeights[i] || ESTIMATED_PARAGRAPH_HEIGHT;
      accumulatedHeight += height;
      
      if (accumulatedHeight >= scrollTop - containerTop + viewportHeight * 2) {
        endIndex = i + 1;
        break;
      }
    }
    
    setVisibleRange({ start: startIndex, end: endIndex });
  }, [processedContent, paragraphHeights]);

  // Set up scroll listener
  useEffect(() => {
    handleScroll(); // Initial calculation
    
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };
    
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [handleScroll]);

  // Measure paragraph heights using Intersection Observer
  useEffect(() => {
    if (!processedContent || processedContent.length === 0) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = parseInt(entry.target.getAttribute("data-index") || "0", 10);
          if (entry.isIntersecting) {
            setParagraphHeights((prev) => ({
              ...prev,
              [index]: entry.boundingClientRect.height,
            }));
          }
        });
      },
      {
        rootMargin: "200px 0px",
        threshold: 0,
      }
    );
    
    // Observe all paragraph elements
    const paragraphs = containerRef.current?.querySelectorAll(".paragraph");
    paragraphs?.forEach((p) => observer.observe(p));
    
    return () => observer.disconnect();
  }, [processedContent, visibleRange]);

  // If we have processed content, use it for rendering
  if (processedContent && processedContent.length > 0) {
    return (
      <div className="reading-area" ref={containerRef}>
        <div className="text-content" style={{ minHeight: totalHeight }}>
          {/* Top spacer */}
          <div style={{ height: topSpacerHeight }} />
          
          {/* Render visible paragraphs */}
          {visibleParagraphs.map(({ paragraph, pIndex }) => {
            return (
              <div key={pIndex} data-index={pIndex} style={{ minHeight: paragraphHeights[pIndex] || ESTIMATED_PARAGRAPH_HEIGHT }}>
                <Paragraph
                  paragraph={paragraph}
                  pIndex={pIndex}
                  onWordClick={onWordClick}
                  getWordAnnotation={getWordAnnotation}
                  isClickable={isClickable}
                />
              </div>
            );
          })}
        </div>
        
        <style jsx>{`
          .reading-area {
            padding: 2rem;
            max-width: 800px;
            margin: 0 auto;
          }
          
          .text-content {
            font-family: Georgia, "Times New Roman", serif;
            font-size: 18px;
            color: #333;
            text-align: justify;
            line-height: 1.8;
          }
          
          .paragraph {
            margin-bottom: 20px;
          }
          
          .whitespace {
            white-space: pre-wrap;
          }
          
          .punctuation {
            color: #666;
          }
          
          .word {
            display: inline;
            cursor: default;
          }
          
          .word.clickable {
            cursor: pointer;
          }
          
          .word.clickable:hover {
            color: #4A90D9;
          }
          
          .word.annotated {
            color: inherit;
          }
          
          .word-text {
            display: inline;
          }
          
          .word-annotation {
            display: inline;
            font-size: 70%;
            color: #E74C3C;
            font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
            font-weight: normal;
            margin-left: 0;
          }
        `}</style>
      </div>
    );
  }

  // Fallback: render plain text
  return (
    <div className="reading-area">
      <div className="text-content" style={{ whiteSpace: "pre-wrap" }}>
        {text}
      </div>
      
      <style jsx>{`
        .reading-area {
          padding: 2rem;
          max-width: 800px;
          margin: 0 auto;
        }
        
        .text-content {
          font-family: Georgia, "Times New Roman", serif;
          font-size: 18px;
          line-height: 1.8;
          color: #333;
          text-align: justify;
        }
      `}</style>
    </div>
  );
}