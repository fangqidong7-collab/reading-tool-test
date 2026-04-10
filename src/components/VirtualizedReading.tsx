"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { useVirtualizer } from '@tanstack/react-virtual';
import { ProcessedContent } from "@/hooks/useBookshelf";

type Annotations = Record<string, { root: string; meaning: string; pos: string; count: number }>;

interface VirtualizedReadingProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  containerHeight: number;
  backgroundColor: string;
  currentHorizPadding: number;
  processedContent: ProcessedContent;
  onWordClick: (word: string, lemma: string, event: React.MouseEvent) => void;
  annotations?: Annotations;
  annotationColor?: string;
  searchQuery?: string;
  searchResults?: Array<{ paragraphIndex: number; charIndex: number }>;
  currentSearchIndex?: number;
  highlightBg?: string;
  isDarkMode?: boolean;
  fontSize?: number;
  lineHeight?: number;
  textColor?: string;
  readProgress: number;
}

interface ParagraphProps {
  paragraph: ProcessedContent[number];
  pIndex: number;
  onWordClick: (word: string, lemma: string, event: React.MouseEvent) => void;
  annotations?: Annotations;
  annotationColor?: string;
  searchQuery?: string;
  isCurrentSearchResult?: boolean;
  highlightBg?: string;
  isDarkMode?: boolean;
  fontSize: number;
  lineHeight: number;
  textColor: string;
}

const Paragraph = React.memo(({
  paragraph,
  pIndex,
  onWordClick,
  annotations,
  annotationColor = "#E74C3C",
  searchQuery = "",
  isCurrentSearchResult = false,
  highlightBg = "#FFEB3B",
  isDarkMode = false,
  fontSize,
  lineHeight,
  textColor,
}: ParagraphProps) => {
  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('word')) {
      const word = target.dataset.word || '';
      const lemma = target.dataset.lemma || '';
      onWordClick(word, lemma, e);
    }
  }, [onWordClick]);

  const isHeading = paragraph.headingLevel !== undefined;
  const headingLevel = paragraph.headingLevel || 2;

  const getHeadingStyles = (): React.CSSProperties => {
    const baseColor = isDarkMode ? "#E0E0E0" : "#333";
    switch (headingLevel) {
      case 1:
        return {
          fontSize: '1.6em',
          fontWeight: 'bold',
          textAlign: 'center',
          marginTop: '40px',
          marginBottom: '20px',
          color: baseColor,
        };
      case 2:
        return {
          fontSize: '1.4em',
          fontWeight: 'bold',
          textAlign: 'center',
          marginTop: '30px',
          marginBottom: '16px',
          color: baseColor,
        };
      case 3:
        return {
          fontSize: '1.2em',
          fontWeight: 'bold',
          marginTop: '24px',
          marginBottom: '12px',
          color: baseColor,
        };
      default:
        return {
          fontSize: '1.1em',
          fontWeight: 'bold',
          marginTop: '20px',
          marginBottom: '10px',
          color: baseColor,
        };
    }
  };

  return (
    <p
      className={`paragraph ${isHeading ? 'heading-paragraph' : ''} ${isCurrentSearchResult ? 'search-highlight' : ''}`}
      data-paragraph-index={pIndex}
      data-heading-level={isHeading ? headingLevel : undefined}
      onClick={handleClick}
      style={isCurrentSearchResult ? { backgroundColor: highlightBg } : (isHeading ? getHeadingStyles() : undefined)}
    >
      {paragraph.segments.map((segment, sIndex) => {
        const key = `${pIndex}-${sIndex}`;
        if (segment.type === "space" || segment.type === "punctuation") {
          return <span key={key}>{segment.text}</span>;
        }

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

function paragraphPropsAreEqual(
  prev: ParagraphProps,
  next: ParagraphProps
) {
  if (prev.pIndex !== next.pIndex) return false;
  if (prev.onWordClick !== next.onWordClick) return false;
  if (prev.annotationColor !== next.annotationColor) return false;
  if (prev.isCurrentSearchResult !== next.isCurrentSearchResult) return false;
  if (prev.highlightBg !== next.highlightBg) return false;
  if (prev.isDarkMode !== next.isDarkMode) return false;
  if (prev.fontSize !== next.fontSize) return false;
  if (prev.lineHeight !== next.lineHeight) return false;
  if (prev.textColor !== next.textColor) return false;

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

export function VirtualizedReading({
  containerRef,
  contentRef,
  containerHeight,
  backgroundColor,
  currentHorizPadding,
  processedContent,
  onWordClick,
  annotations,
  annotationColor = "#E74C3C",
  searchQuery = "",
  searchResults = [],
  currentSearchIndex = 0,
  highlightBg = "#FFEB3B",
  isDarkMode = false,
  fontSize = 18,
  lineHeight = 1.8,
  textColor = "#333333",
  readProgress = 0,
}: VirtualizedReadingProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: processedContent.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 120,
    overscan: 5,
  });

  const items = virtualizer.getVirtualItems();

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
      <div
        ref={parentRef}
        className="reading-container"
        style={{
          height: containerHeight,
          overflowY: "auto",
          overflowX: "hidden",
          position: "relative",
          padding: "0px",
          boxSizing: "border-box",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div
          ref={contentRef}
          className="reader-content"
          style={{
            paddingLeft: `${currentHorizPadding}px`,
            paddingRight: `${currentHorizPadding}px`,
            paddingTop: "20px",
            paddingBottom: "40px",
            height: `${virtualizer.getTotalSize()}px`,
            position: "relative",
          }}
        >
          {items.map((virtualItem) => {
            const paragraph = processedContent[virtualItem.index];
            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <MemoizedParagraph
                  paragraph={paragraph}
                  pIndex={virtualItem.index}
                  onWordClick={onWordClick}
                  annotations={annotations}
                  annotationColor={annotationColor}
                  searchQuery={searchQuery}
                  isCurrentSearchResult={searchResults.length > 0 && searchResults[currentSearchIndex]?.paragraphIndex === virtualItem.index}
                  highlightBg={highlightBg}
                  isDarkMode={isDarkMode}
                  fontSize={fontSize}
                  lineHeight={lineHeight}
                  textColor={textColor}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div style={{
        position: "fixed",
        bottom: 12,
        right: 16,
        fontSize: "12px",
        color: isDarkMode ? "#888" : "#999",
        background: isDarkMode ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.85)",
        padding: "4px 10px",
        borderRadius: "12px",
        zIndex: 100,
        pointerEvents: "none",
      }}>
        {readProgress}%
      </div>

      <style jsx>{`
        .reading-wrapper {
          min-height: 100vh;
          position: relative;
        }

        .reading-container {
          flex: 1;
        }

        .reader-content {
          font-size: ${fontSize}px;
          line-height: ${lineHeight};
          color: ${textColor};
          font-family: Georgia, "Times New Roman", serif;
          text-align: justify;
        }

        .reader-content :global(.paragraph) {
          margin-bottom: 16px;
          margin-top: 0px;
        }

        .reader-content :global(.word) {
          cursor: pointer;
          transition: color 0.15s;
        }

        .reader-content :global(.word:hover) {
          color: #4A90D9;
        }

        .reader-content :global(.annotation) {
          color: ${annotationColor};
          font-size: 0.7em;
          font-family: "Microsoft YaHei", "微软雅黑", sans-serif;
        }

        @media (max-width: 768px) {
          .reading-wrapper {
            min-height: 100dvh !important;
            height: 100dvh !important;
          }
        }
      `}</style>
    </div>
  );
}
