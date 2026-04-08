"use client";

import React, { useRef, useState, useEffect, useCallback, memo } from "react";
import { ProcessedContent } from "@/hooks/useBookshelf";

// Virtual scroll configuration
const BUFFER_SIZE = 5;
const ESTIMATED_PARAGRAPH_HEIGHT = 80;

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

  // Calculate visible paragraphs
  const visibleParagraphs = React.useMemo(() => {
    if (!processedContent) return [];
    const total = processedContent.length;
    const start = Math.max(0, visibleRange.start - BUFFER_SIZE);
    const end = Math.min(total, visibleRange.end + BUFFER_SIZE);
    return processedContent.slice(start, end).map((p, i) => ({ paragraph: p, pIndex: start + i }));
  }, [processedContent, visibleRange]);

  // Total height calculation
  const totalHeight = React.useMemo(() => {
    if (!processedContent) return 0;
    let height = 0;
    for (let i = 0; i < processedContent.length; i++) {
      height += paragraphHeights[i] || ESTIMATED_PARAGRAPH_HEIGHT;
    }
    return height;
  }, [processedContent, paragraphHeights]);

  // Top spacer height
  const topSpacerHeight = React.useMemo(() => {
    if (!processedContent) return 0;
    let height = 0;
    const start = Math.max(0, visibleRange.start - BUFFER_SIZE);
    for (let i = 0; i < start; i++) {
      height += paragraphHeights[i] || ESTIMATED_PARAGRAPH_HEIGHT;
    }
    return height;
  }, [processedContent, paragraphHeights, visibleRange.start]);

  // Handle scroll
  const handleScroll = useCallback(() => {
    if (!containerRef.current || !processedContent) return;
    
    const scrollTop = window.scrollY;
    const containerTop = containerRef.current.offsetTop || 0;
    const viewportHeight = window.innerHeight;
    
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

  // Scroll listener
  useEffect(() => {
    handleScroll();
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
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

  // Measure paragraph heights
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
      { rootMargin: "200px 0px", threshold: 0 }
    );
    
    const paragraphs = containerRef.current?.querySelectorAll(".paragraph");
    paragraphs?.forEach((p) => observer.observe(p));
    return () => observer.disconnect();
  }, [processedContent, visibleRange]);

  // Render content
  if (processedContent && processedContent.length > 0) {
    return (
      <div className="reading-area" ref={containerRef}>
        <div className="text-content" style={{ minHeight: totalHeight }}>
          <div style={{ height: topSpacerHeight }} />
          {visibleParagraphs.map(({ paragraph, pIndex }) => (
            <div key={pIndex} data-index={pIndex} style={{ minHeight: paragraphHeights[pIndex] || ESTIMATED_PARAGRAPH_HEIGHT }}>
              <Paragraph
                paragraph={paragraph}
                pIndex={pIndex}
                onWordClick={onWordClick}
                getWordAnnotation={getWordAnnotation}
                isClickable={isClickable}
              />
            </div>
          ))}
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
          
          .paragraph {
            margin-bottom: 1.2em;
          }
          
          .whitespace {
            white-space: pre-wrap;
          }
          
          .punctuation {
            color: #666;
          }
          
          .word.clickable {
            cursor: pointer;
          }
          
          .word.clickable:hover {
            color: #4A90D9;
          }
          
          .annotated {
            cursor: pointer;
            background-color: #FFF3CD;
            padding: 1px 0;
            border-radius: 2px;
          }
          
          .annotated:hover {
            background-color: #FFE69C;
          }
          
          .annotation {
            color: #E74C3C;
            font-size: 70%;
            font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
            font-weight: normal;
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
        }
      `}</style>
    </div>
  );
}
