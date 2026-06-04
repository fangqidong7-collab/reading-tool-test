"use client";

import React, { useCallback, useRef, useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { ProcessedContent, SentenceAnnotation } from "@/hooks/useBookshelf";
import { useVirtualizer } from "@tanstack/react-virtual";
import { getLevelColor, type CEFRLevel } from "@/lib/vocabLevel";
import type { CefrColorPaletteId } from "@/lib/cefrColorPalettes";
import {
  aboveModeParagraphPaddingTop,
  type AnnotationDisplayMode,
} from "@/lib/readingAnnotationLayout";

// Layout constants
const READING_PADDING_HORIZONTAL = 32;
const MOBILE_READING_PADDING_HORIZONTAL = 12;
const MOBILE_BREAKPOINT = 768;
const MOBILE_BOTTOM_SAFE_ZONE = 60;
const DESKTOP_BOTTOM_SAFE_ZONE = 40;
const PAGE_TURN_EDGE_EPS = 3;

/**
 * Collect paragraph line rects from virtual items.
 * @param extendAbove  extra px above the viewport to include (for "prev" page calculation)
 */
function gatherParagraphLineRects(
  contentRoot: HTMLElement,
  scrollEl: HTMLElement,
  virtualIndices: readonly { index: number }[],
  extendAbove = 0
): DOMRect[] {
  const cRect = scrollEl.getBoundingClientRect();
  const minLineHeight = 6;
  const minWidth = 4;
  const out: DOMRect[] = [];

  for (const { index } of virtualIndices) {
    const wrap = contentRoot.querySelector(`[data-index="${index}"]`);
    if (!wrap) continue;
    const paragraph = wrap.querySelector(".paragraph");
    if (!paragraph) continue;

    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const list = range.getClientRects();
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (r.height < minLineHeight || r.width < minWidth) continue;
      if (r.bottom < cRect.top - extendAbove || r.top > cRect.bottom) continue;
      out.push(r);
    }
  }
  return out;
}

/** Merge raw rects into unique visual lines (same-line fragments share similar top). */
function deduplicateLines(rects: DOMRect[]): DOMRect[] {
  const sorted = [...rects].sort((a, b) => a.top - b.top);
  const lines: DOMRect[] = [];
  for (const r of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(r.top - last.top) < Math.min(r.height, last.height) * 0.5) {
      if (r.bottom > last.bottom) lines[lines.length - 1] = r;
      continue;
    }
    lines.push(r);
  }
  return lines;
}

/**
 * Page-turn algorithm: returns the target scrollTop for next/prev page.
 *
 * Principles (like a traditional e-reader):
 *  - Top of the page always aligns to a line boundary (no half-line at top)
 *  - No repeated lines between pages
 *  - Bottom partial line will be hidden by a mask overlay
 */
function computeSnappedPageScrollTop(
  scrollEl: HTMLElement,
  contentRoot: HTMLElement,
  virtualIndices: readonly { index: number }[],
  direction: "next" | "prev",
  pageStepPx: number
): number {
  const S = scrollEl.scrollTop;
  const H = scrollEl.clientHeight;
  const maxS = Math.max(0, scrollEl.scrollHeight - H);
  const cRect = scrollEl.getBoundingClientRect();
  const edge = PAGE_TURN_EDGE_EPS;

  const extendAbove = direction === "prev" ? H : 0;
  const rawRects = gatherParagraphLineRects(contentRoot, scrollEl, virtualIndices, extendAbove);
  const allLines = deduplicateLines(rawRects);

  const fullyVisible = allLines
    .filter(r => r.top >= cRect.top - edge && r.bottom <= cRect.bottom + edge);

  if (direction === "next") {
    if (fullyVisible.length === 0) {
      return Math.min(S + pageStepPx, maxS);
    }
    const lastFV = fullyVisible[fullyVisible.length - 1];
    const T = S + (lastFV.bottom - cRect.top);
    if (T > S + 0.5) return Math.min(T, maxS);
    return Math.min(S + pageStepPx, maxS);
  }

  // direction === "prev"
  const currentStartIdx = allLines.findIndex(r => r.top >= cRect.top - edge);
  if (currentStartIdx <= 0) {
    return 0;
  }

  let prevStartIdx = currentStartIdx - 1;
  for (let i = currentStartIdx - 2; i >= 0; i--) {
    const span = allLines[currentStartIdx - 1].bottom - allLines[i].top;
    if (span > H) break;
    prevStartIdx = i;
  }

  const T = S + (allLines[prevStartIdx].top - cRect.top);
  if (T < S - 0.5) return Math.max(0, T);
  return Math.max(0, S - pageStepPx);
}

// Ref type
export interface ReadingAreaRef {
  jumpToParagraph: (paragraphIndex: number) => void;
  jumpToSearchResult: (result: { paragraphIndex: number; charIndex: number }) => void;
  getScrollPercent: () => number;
  getFirstVisibleIndex: () => { index: number; offsetRatio: number };
  addBookmark: () => void;
  restoreScrollPosition: (percent: number) => void;
  restoreByParagraphIndex: (index: number) => void;
}



// Bookmark interface
export interface Bookmark {
  id: string;
  scrollRatio: number;
  percent: number;
  preview: string;
  createdAt: number;
}

// Memoized paragraph component
type Annotations = Record<string, { root: string; meaning: string; pos: string; count: number; cefrLevel?: string }>;

interface ParagraphProps {
  paragraph: ProcessedContent[number];
  pIndex: number;
  onWordClick: (word: string, lemma: string, event: React.MouseEvent) => void;
  onWordDoubleClick?: (word: string, lemma: string, event: React.MouseEvent) => void;
  annotations?: Annotations;
  annotationColor?: string;
  searchQuery?: string;
  isCurrentSearchResult?: boolean;
  highlightBg?: string;
  isDarkMode?: boolean;
  cefrColorPalette?: CefrColorPaletteId;
  annotationDisplayMode?: AnnotationDisplayMode;
  annotationFontSize?: number;
  sentenceAnnotations?: SentenceAnnotation[];
  onRemoveSentenceAnnotation?: (id: string) => void;
  onRemoveAnnotation?: (word: string, lemma: string) => void;
  /** TTS: ID of the currently speaking sentence, e.g. "tts-p0-s2" */
  ttsSentenceId?: string;
  /** TTS: true while any sentence is being spoken */
  ttsPlaying?: boolean;
}

const Paragraph = React.memo(({
  paragraph,
  pIndex,
  onWordClick,
  onWordDoubleClick,
  annotations,
  annotationColor = "#E74C3C",
  searchQuery = "",
  isCurrentSearchResult = false,
  highlightBg = "#FFEB3B",
  isDarkMode = false,
  cefrColorPalette = 'standard',
  annotationDisplayMode = 'inline',
  annotationFontSize = 12,
  sentenceAnnotations = [],
  onRemoveSentenceAnnotation,
  onRemoveAnnotation,
  ttsSentenceId,
  ttsPlaying = false,
}: ParagraphProps) => {
  // Parse the paragraph text and split into TTS sentences with character ranges
  const fullText = paragraph.segments.map(s => s.text).join('');

  // TTS: compute sentence character ranges for this paragraph
  const ttsSentenceRanges: Array<{ id: string; start: number; end: number }> = [];
  if (ttsPlaying) {
    // e.g. ttsSentenceId = "tts-p5-s2"
    if (ttsSentenceId) {
      const parsed = ttsSentenceId.match(/^tts-p(\d+)-s(\d+)$/);
      if (parsed && parseInt(parsed[1], 10) === pIndex) {
        const sIdx = parseInt(parsed[2], 10);
        const ABBR_RE = /\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|Gen|Gov|Sgt|Cpl|Pvt|Capt|Lt|Col|Maj|Rev|Hon|Drs|Messrs|Mmes|No|Nos|Vol|vs|etc|al|approx|dept|est|govt|incl|intl|natl|assn|ave|blvd|dept|dist|div|est|ext|ft|hwy|inc|ltd|mt|pkg|pres|govt|univ)\.\s/gi;
        const placeholders: string[] = [];
        const protected_ = fullText.replace(ABBR_RE, (match) => {
          const idx = placeholders.length;
          placeholders.push(match);
          return `\x00ABBR${idx}\x00`;
        });
        const rawParts = protected_.match(/[^.!?。！？；;]*[.!?。！？；;]+["'""''）)»\s]*/g) || [];
        const merged: string[] = [];
        for (const part of rawParts) {
          if (merged.length > 0 && !/\s$/.test(merged[merged.length - 1])) {
            merged[merged.length - 1] += part;
          } else {
            merged.push(part);
          }
        }
        const remainder = protected_.slice(rawParts.join('').length).trim();
        const sentences = merged.map(s => s.trim()).filter(Boolean);
        if (remainder && /[a-zA-Z0-9\u4e00-\u9fff]/.test(remainder)) sentences.push(remainder);
        if (sentences.length === 0 && fullText.trim()) sentences.push(fullText.trim());
        for (let i = 0; i < sentences.length; i++) {
          sentences[i] = sentences[i].replace(/\x00ABBR(\d+)\x00/g, (_, j) => placeholders[parseInt(j)]);
        }
        let offset = 0;
        sentences.forEach((s, i) => {
          const idx = fullText.indexOf(s, offset);
          if (idx >= 0) {
            ttsSentenceRanges.push({ id: `tts-p${pIndex}-s${i}`, start: idx, end: idx + s.length });
            offset = idx + s.length;
          }
        });
      }
    }
  }

  // Helper: is a character offset inside the current TTS sentence?
  const isInTtsSentence = (charOffset: number): boolean => {
    if (!ttsSentenceId) return false;
    const range = ttsSentenceRanges.find(r => r.id === ttsSentenceId);
    return !!range && charOffset >= range.start && charOffset < range.end;
  };
  const handleClick = useCallback((e: React.MouseEvent) => {
    const sel = typeof window !== 'undefined' ? window.getSelection() : null;
    if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) {
      return;
    }
    const target = e.target as HTMLElement;
    if (target.classList.contains('word')) {
      const word = target.dataset.word || '';
      const lemma = target.dataset.lemma || '';
      onWordClick(word, lemma, e);
    }
  }, [onWordClick]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    window.getSelection()?.removeAllRanges();
    const target = e.target as HTMLElement;
    if (target.classList.contains('word')) {
      const word = target.dataset.word || '';
      const lemma = target.dataset.lemma || '';
      if (onWordDoubleClick) {
        onWordDoubleClick(word, lemma, e);
      }
    }
  }, [onWordDoubleClick]);

  // Check if this is a heading paragraph
  const isHeading = paragraph.headingLevel !== undefined;
  const headingLevel = paragraph.headingLevel || 2;

  // Build text content for search matching (reused below)
  const segmentOffsets: number[] = [];
  let charOffset = 0;
  for (const seg of paragraph.segments) {
    segmentOffsets.push(charOffset);
    charOffset += seg.text.length;
  }
  const totalChars = charOffset;

  // Find sentence annotations that affect this paragraph
  const relevantSentenceAnnotations = sentenceAnnotations.filter(
    (sa) => sa.startParagraphIndex <= pIndex && sa.endParagraphIndex >= pIndex
  );

  // Get sentence annotation for a given character position
  const getSentenceAnnotationForChar = (charPos: number): SentenceAnnotation | null => {
    for (const sa of relevantSentenceAnnotations) {
      let rangeStart = 0;
      let rangeEnd = totalChars;

      if (sa.startParagraphIndex === pIndex) {
        rangeStart = sa.startCharIndex;
      }
      if (sa.endParagraphIndex === pIndex) {
        rangeEnd = sa.endCharIndex;
      }

      if (charPos >= rangeStart && charPos < rangeEnd) {
        return sa;
      }
    }
    return null;
  };

  // Check if a segment is the last segment of a sentence annotation
  const isLastSegmentOfAnnotation = (segIndex: number, sa: SentenceAnnotation): boolean => {
    if (sa.endParagraphIndex !== pIndex) return false;
    const segStart = segmentOffsets[segIndex];
    const segEnd = segStart + paragraph.segments[segIndex].text.length;
    if (segIndex + 1 < paragraph.segments.length) {
      const nextSegStart = segmentOffsets[segIndex + 1];
      return nextSegStart >= sa.endCharIndex;
    }
    return true;
  };

  // Get heading styles based on level
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
      default: // h4-h6
        return {
          fontSize: '1.1em',
          fontWeight: 'bold',
          marginTop: '20px',
          marginBottom: '10px',
          color: baseColor,
        };
    }
  };

  // Underline style for sentence annotations
  const getUnderlineStyle = (): React.CSSProperties => ({
    textDecoration: 'underline',
    textDecorationColor: isDarkMode ? '#6ba3e0' : '#4a90d9',
    textDecorationThickness: '2px',
    textUnderlineOffset: '3px',
  });

  // TTS: background highlight style for the current speaking sentence
  const getTtsHighlightStyle = (): React.CSSProperties => ({
    backgroundColor: '#d4edda',
    borderRadius: '2px',
    padding: '1px 0',
  });

  return (
    <p 
      className={`paragraph ${isHeading ? 'heading-paragraph' : ''} ${isCurrentSearchResult ? 'search-highlight' : ''}${annotationDisplayMode === 'above' ? ' paragraph-above-annotations' : ''}`}
      data-paragraph-index={pIndex}
      data-heading-level={isHeading ? headingLevel : undefined}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      style={{
        ...(isCurrentSearchResult ? { backgroundColor: highlightBg } : (isHeading ? getHeadingStyles() : undefined)),
        ...(annotationDisplayMode === 'above'
          ? { paddingTop: aboveModeParagraphPaddingTop(annotationFontSize) }
          : undefined),
      }}
    >
      {paragraph.segments.map((segment, sIndex) => {
        const key = `${pIndex}-${sIndex}`;
        const segCharStart = segmentOffsets[sIndex];
        const matchedSA = getSentenceAnnotationForChar(segCharStart);
        const hasUnderline = !!matchedSA;
        const showTranslation = matchedSA && isLastSegmentOfAnnotation(sIndex, matchedSA);

        if (segment.type === "space" || segment.type === "punctuation") {
          return (
            <React.Fragment key={key}>
              <span style={hasUnderline ? getUnderlineStyle() : (isInTtsSentence(segCharStart) ? getTtsHighlightStyle() : undefined)}>
                {segment.text}
              </span>
              {showTranslation && matchedSA && (
                <span
                  className="sentence-annotation"
                  title={`点击删除${matchedSA.type === 'note' ? '笔记' : '翻译标注'}\n原文: ${matchedSA.originalText}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onRemoveSentenceAnnotation) {
                      onRemoveSentenceAnnotation(matchedSA.id);
                    }
                  }}
                  style={{
                    color: matchedSA.type === 'note' ? '#3498db' : annotationColor,
                    fontSize: '0.75em',
                    fontFamily: '"Microsoft YaHei", "微软雅黑", sans-serif',
                    cursor: 'pointer',
                    marginLeft: '2px',
                  }}
                >
                  {matchedSA.type === 'note' ? `〔${matchedSA.translation}〕` : `【${matchedSA.translation}】`}
                </span>
              )}
            </React.Fragment>
          );
        }
        
        const lemma = segment.lemma;
        const original = segment.text.toLowerCase();
        const annotation = annotations?.[original] || annotations?.[lemma];
        const isAnnotated = !!annotation;
        const meaningColor = annotation
          ? (annotation.cefrLevel
            ? getLevelColor(annotation.cefrLevel as CEFRLevel, cefrColorPalette, isDarkMode) || annotationColor
            : annotationColor)
          : annotationColor;
        const annotationStyle: React.CSSProperties = {
          color: meaningColor,
          fontSize: `${annotationFontSize}px`,
          fontFamily: '"Microsoft YaHei", "微软雅黑", sans-serif',
          cursor: 'pointer',
          ...(hasUnderline ? getUnderlineStyle() : {}),
        };
        const handleAnnotationClick = (e: React.MouseEvent) => {
          e.stopPropagation();
          if (onRemoveAnnotation) {
            onRemoveAnnotation(segment.text, lemma);
          }
        };
        
        return (
          <React.Fragment key={key}>
            {isAnnotated && annotationDisplayMode === 'above' ? (
              <span className="annotated-unit">
                <span
                  className="word"
                  data-word={segment.text}
                  data-lemma={lemma}
                  style={{
                    ...(hasUnderline ? getUnderlineStyle() : {}),
                    ...(isInTtsSentence(segCharStart) ? getTtsHighlightStyle() : {}),
                  }}
                >
                  {segment.text}
                </span>
                <span
                  className="annotation-above"
                  onClick={handleAnnotationClick}
                  style={annotationStyle}
                >
                  {annotation.meaning}
                </span>
              </span>
            ) : (
              <>
                <span
                  className="word"
                  data-word={segment.text}
                  data-lemma={lemma}
                  style={{
                    ...(hasUnderline ? getUnderlineStyle() : {}),
                    ...(isInTtsSentence(segCharStart) ? getTtsHighlightStyle() : {}),
                  }}
                >
                  {segment.text}
                </span>
                {isAnnotated && (
                  <span
                    className="annotation"
                    onClick={handleAnnotationClick}
                    style={annotationStyle}
                  >
                    ({annotation.meaning})
                  </span>
                )}
              </>
            )}
            {showTranslation && matchedSA && (
              <span
                className="sentence-annotation"
                title={`点击删除${matchedSA.type === 'note' ? '笔记' : '翻译标注'}\n原文: ${matchedSA.originalText}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onRemoveSentenceAnnotation) {
                    onRemoveSentenceAnnotation(matchedSA.id);
                  }
                }}
                style={{
                  color: matchedSA.type === 'note' ? '#3498db' : annotationColor,
                  fontSize: '0.75em',
                  fontFamily: '"Microsoft YaHei", "微软雅黑", sans-serif',
                  cursor: 'pointer',
                  marginLeft: '2px',
                }}
              >
                {matchedSA.type === 'note' ? `〔${matchedSA.translation}〕` : `【${matchedSA.translation}】`}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </p>
  );
});

Paragraph.displayName = "Paragraph";

// Custom comparison function
function paragraphPropsAreEqual(
  prev: {
    paragraph: ProcessedContent[number];
    pIndex: number;
    onWordClick: (word: string, lemma: string, event: React.MouseEvent) => void;
    onWordDoubleClick?: (word: string, lemma: string, event: React.MouseEvent) => void;
    annotations?: Annotations;
    annotationColor?: string;
    searchQuery?: string;
    isCurrentSearchResult?: boolean;
    highlightBg?: string;
    isDarkMode?: boolean;
    cefrColorPalette?: CefrColorPaletteId;
    annotationDisplayMode?: AnnotationDisplayMode;
    annotationFontSize?: number;
    sentenceAnnotations?: SentenceAnnotation[];
    onRemoveSentenceAnnotation?: (id: string) => void;
    onRemoveAnnotation?: (word: string, lemma: string) => void;
    ttsSentenceId?: string;
    ttsPlaying?: boolean;
  },
  next: {
    paragraph: ProcessedContent[number];
    pIndex: number;
    onWordClick: (word: string, lemma: string, event: React.MouseEvent) => void;
    onWordDoubleClick?: (word: string, lemma: string, event: React.MouseEvent) => void;
    annotations?: Annotations;
    annotationColor?: string;
    searchQuery?: string;
    isCurrentSearchResult?: boolean;
    highlightBg?: string;
    isDarkMode?: boolean;
    cefrColorPalette?: CefrColorPaletteId;
    annotationDisplayMode?: AnnotationDisplayMode;
    annotationFontSize?: number;
    sentenceAnnotations?: SentenceAnnotation[];
    onRemoveSentenceAnnotation?: (id: string) => void;
    onRemoveAnnotation?: (word: string, lemma: string) => void;
    ttsSentenceId?: string;
    ttsPlaying?: boolean;
  }
) {
  if (prev.pIndex !== next.pIndex) return false;
  if (prev.onWordClick !== next.onWordClick) return false;
  if (prev.annotationColor !== next.annotationColor) return false;
  if (prev.searchQuery !== next.searchQuery) return false;
  if (prev.isCurrentSearchResult !== next.isCurrentSearchResult) return false;
  if (prev.highlightBg !== next.highlightBg) return false;
  if (prev.isDarkMode !== next.isDarkMode) return false;
  if (prev.cefrColorPalette !== next.cefrColorPalette) return false;
  if (prev.annotationDisplayMode !== next.annotationDisplayMode) return false;
  if (prev.annotationFontSize !== next.annotationFontSize) return false;
  if (prev.onWordDoubleClick !== next.onWordDoubleClick) return false;
  if (prev.sentenceAnnotations !== next.sentenceAnnotations) return false;
  if (prev.onRemoveSentenceAnnotation !== next.onRemoveSentenceAnnotation) return false;
  if (prev.ttsSentenceId !== next.ttsSentenceId) return false;
  if (prev.ttsPlaying !== next.ttsPlaying) return false;

  if (prev.paragraph !== next.paragraph) return false;

  /**
   * 全文 annotations 是一个大 Map，若按 key 逐项比较，标注上千时每个段落 memo 都会对上千 key 做一次 O(n)，
   * 虚拟列表一趟渲染 ≈ O(可见段数 × 标注数)，手机会直接卡死。
   * 引用由上层 useMemo（mergedAnnotationsForRender）保持稳定，仅在真实增删改时换新对象。
   */
  if (prev.annotations !== next.annotations) return false;

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
  fontSize?: number;
  lineHeight?: number;
  textColor?: string;
  backgroundColor?: string;
  annotationColor?: string;
  annotationFontSize?: number;
  annotationDisplayMode?: AnnotationDisplayMode;
  highlightBg?: string;
  highlightBgHover?: string;
  isDarkMode?: boolean;
  cefrColorPalette?: CefrColorPaletteId;
  headerVisible?: boolean;
  searchQuery?: string;
  searchResults?: Array<{ paragraphIndex: number; charIndex: number }>;
  currentSearchIndex?: number;
  bookId?: string;
  onProgressChange?: (percent: number) => void;
  onParagraphIndexChange?: (index: number, offsetRatio: number) => void;
  onWordDoubleClick?: (word: string, lemma: string, event: React.MouseEvent) => void;
  onAddBookmark?: () => void;
  initialScrollPercent?: number;
  initialParagraphIndex?: number;
  initialParagraphText?: string;
  initialParagraphOffsetRatio?: number;
  pageTurnRatio?: number;
  onTextSelect?: (selection: { text: string; startParagraphIndex: number; endParagraphIndex: number; startCharIndex: number; endCharIndex: number }) => void;
  sentenceAnnotations?: SentenceAnnotation[];
  onRemoveSentenceAnnotation?: (id: string) => void;
  onRemoveAnnotation?: (word: string, lemma: string) => void;
  clickToTurnPage?: boolean;
  /** TTS: ID of the currently speaking sentence, e.g. "tts-p0-s2" */
  ttsSentenceId?: string;
  /** TTS: true while any sentence is being spoken */
  ttsPlaying?: boolean;
  fontFamilyCss?: string;
}

export const ReadingArea = forwardRef(function ReadingArea({
  text,
  processedContent,
  annotations,
  onWordClick,
  getWordAnnotation,
  isClickable,
  fontSize = 18,
  lineHeight = 1.8,
  textColor = "#333333",
  backgroundColor = "#FFF8F0",
  annotationColor = "#E74C3C",
  annotationFontSize = 12,
  annotationDisplayMode = 'inline',
  highlightBg = "#FFEB3B",
  highlightBgHover = "#FFD700",
  isDarkMode = false,
  cefrColorPalette = 'standard',
  headerVisible = true,
  searchQuery = "",
  searchResults = [],
  currentSearchIndex = 0,
  bookId = "",
  onProgressChange,
  onParagraphIndexChange,
  onWordDoubleClick,
  onAddBookmark,
  initialScrollPercent = 0,
  initialParagraphIndex = -1,
  initialParagraphText = "",
  initialParagraphOffsetRatio = 0,
  pageTurnRatio = 1,
  onTextSelect,
  sentenceAnnotations = [],
  onRemoveSentenceAnnotation,
  onRemoveAnnotation,
  clickToTurnPage = false,
  ttsSentenceId,
  ttsPlaying = false,
  fontFamilyCss,

}: ReadingAreaProps, ref: React.Ref<ReadingAreaRef>) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const bottomMaskRef = useRef<HTMLDivElement>(null);
  const selectionStartRef = useRef<{ paragraphIndex: number; charIndex: number } | null>(null);
  
  const [readProgress, setReadProgress] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastSwipeTimeRef = useRef(0);

  const virtualizer = useVirtualizer({
    count: processedContent ? processedContent.length : 0,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 80,
    overscan: 24,
  });

  const updatePageMask = useCallback(() => {
    const mask = bottomMaskRef.current;
    if (!mask) return;
    if (!clickToTurnPage || !containerRef.current || !contentRef.current) {
      mask.style.display = "none";
      return;
    }
    const scrollEl = containerRef.current;
    const cRect = scrollEl.getBoundingClientRect();
    const H = scrollEl.clientHeight;
    const items = virtualizer.getVirtualItems();
    if (items.length === 0) { mask.style.display = "none"; return; }

    const rawRects = gatherParagraphLineRects(contentRef.current, scrollEl, items);
    const allLines = deduplicateLines(rawRects);
    const fullyVisible = allLines
      .filter(r => r.top >= cRect.top - PAGE_TURN_EDGE_EPS && r.bottom <= cRect.bottom + PAGE_TURN_EDGE_EPS);

    if (fullyVisible.length > 0) {
      const lastFV = fullyVisible[fullyVisible.length - 1];
      const maskTop = lastFV.bottom - cRect.top;
      const maskH = H - maskTop;
      if (maskH > 2) {
        mask.style.top = `${maskTop}px`;
        mask.style.height = `${maskH}px`;
        mask.style.backgroundColor = backgroundColor;
        mask.style.display = "block";
      } else {
        mask.style.display = "none";
      }
    } else {
      mask.style.display = "none";
    }
  }, [clickToTurnPage, virtualizer, backgroundColor]);

  const scrollReadingPage = useCallback(
    (direction: "next" | "prev") => {
      const el = containerRef.current;
      const content = contentRef.current;
      if (!el) return;

      const pageStepPx = el.clientHeight * pageTurnRatio;
      const maxS = Math.max(0, el.scrollHeight - el.clientHeight);

      if (!processedContent?.length || !content) {
        const delta = direction === "next" ? pageStepPx : -pageStepPx;
        el.scrollTop = Math.min(maxS, Math.max(0, el.scrollTop + delta));
        requestAnimationFrame(() => requestAnimationFrame(() => updatePageMask()));
        return;
      }

      const items = virtualizer.getVirtualItems();
      if (items.length === 0) {
        const delta = direction === "next" ? pageStepPx : -pageStepPx;
        el.scrollTop = Math.min(maxS, Math.max(0, el.scrollTop + delta));
        requestAnimationFrame(() => requestAnimationFrame(() => updatePageMask()));
        return;
      }

      const target = computeSnappedPageScrollTop(el, content, items, direction, pageStepPx);
      el.scrollTop = target;
      requestAnimationFrame(() => requestAnimationFrame(() => updatePageMask()));
    },
    [pageTurnRatio, processedContent, virtualizer, updatePageMask]
  );

  useEffect(() => {
    const calcHeight = () => {
      const el = wrapperRef.current;
      if (!el) return;
      const available = el.clientHeight;
      const mobile = window.innerWidth <= MOBILE_BREAKPOINT;
      const safeZone = mobile ? MOBILE_BOTTOM_SAFE_ZONE : DESKTOP_BOTTOM_SAFE_ZONE;
      const h = available - safeZone;
      setContainerHeight(Math.max(h, 200));
    };
    calcHeight();
    window.addEventListener('resize', calcHeight);
    const ro = new ResizeObserver(calcHeight);
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    return () => {
      window.removeEventListener('resize', calcHeight);
      ro.disconnect();
    };
  }, []);

  // 音量键翻页（仅分页模式）
  useEffect(() => {
    if (!clickToTurnPage) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'AudioVolumeUp' || e.key === 'VolumeUp') {
        e.preventDefault();
        scrollReadingPage("prev");
      } else if (e.key === 'AudioVolumeDown' || e.key === 'VolumeDown') {
        e.preventDefault();
        scrollReadingPage("next");
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scrollReadingPage, clickToTurnPage]);

  useEffect(() => {
    if (clickToTurnPage) {
      requestAnimationFrame(() => requestAnimationFrame(() => updatePageMask()));
      return;
    }
    if (bottomMaskRef.current) {
      bottomMaskRef.current.style.display = "none";
    }
    // 切回滑动模式时强制 virtualizer 重新测量、并触发一次 scroll 事件，
    // 让浏览器重新计算 overflow / touch-action 后的可滚动区域，避免短时滑不动。
    const el = containerRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      try {
        virtualizer.measure();
      } catch { /* ignore */ }
      const prev = el.scrollTop;
      el.scrollTop = prev + 1;
      el.scrollTop = prev;
      el.dispatchEvent(new Event('scroll'));
    });
  }, [clickToTurnPage, updatePageMask, virtualizer]);

  useEffect(() => {
    requestAnimationFrame(() => {
      try {
        virtualizer.measure();
      } catch {
        /* ignore */
      }
    });
  }, [annotationDisplayMode, annotationFontSize, lineHeight, fontSize, virtualizer]);

  // 文本选择功能 - 句子翻译
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return;

    const selectedText = selection.toString().trim();
    if (selectedText.split(/\s+/).length < 2) return;
    if (!processedContent) return;

    const range = selection.getRangeAt(0);

    // 找到 node 所属的 .paragraph 元素和段落索引
    const findParagraphEl = (node: Node): { el: HTMLElement; pIndex: number } | null => {
      let el: HTMLElement | null = node.nodeType === Node.TEXT_NODE ? node.parentElement : node as HTMLElement;
      while (el && !el.classList?.contains('paragraph')) {
        el = el.parentElement;
      }
      if (!el) return null;
      const pIndex = parseInt(el.getAttribute('data-paragraph-index') || '-1', 10);
      if (pIndex < 0) return null;
      return { el, pIndex };
    };

    // 从一个 DOM 节点找到它对应的 segment 索引
    const findSegmentIndex = (node: Node, paragraphEl: HTMLElement, pIndex: number): number => {
      let targetEl: HTMLElement | null = node.nodeType === Node.TEXT_NODE ? node.parentElement : node as HTMLElement;

      // 如果落在 .annotation 上，它紧跟在对应的 .word 后面
      if (targetEl?.classList?.contains('annotation')) {
        let prev = targetEl.previousElementSibling;
        while (prev && !prev.classList?.contains('word')) {
          prev = prev.previousElementSibling;
        }
        if (prev) targetEl = prev as HTMLElement;
      }

      // 如果落在 .sentence-annotation 上，找前面最近的 .word 或普通 span
      if (targetEl?.classList?.contains('sentence-annotation')) {
        let prev = targetEl.previousElementSibling;
        while (prev && prev.classList?.contains('sentence-annotation')) {
          prev = prev.previousElementSibling;
        }
        if (prev) targetEl = prev as HTMLElement;
      }

      if (!targetEl) return 0;

      const para = processedContent![pIndex];
      if (!para) return 0;

      // 如果是 .word 元素，通过 data-word + data-lemma 匹配
      if (targetEl.classList?.contains('word')) {
        const word = targetEl.getAttribute('data-word') || '';
        const lemma = targetEl.getAttribute('data-lemma') || '';

        // 计算这是第几个匹配的 word（处理重复单词）
        const allWords = paragraphEl.querySelectorAll('.word');
        let wordOccurrence = 0;
        for (let i = 0; i < allWords.length; i++) {
          if (allWords[i] === targetEl) break;
          if (allWords[i].getAttribute('data-word') === word &&
              allWords[i].getAttribute('data-lemma') === lemma) {
            wordOccurrence++;
          }
        }

        // 在 segments 中找到对应的 segment
        let matchCount = 0;
        for (let i = 0; i < para.segments.length; i++) {
          const seg = para.segments[i];
          if (seg.type === 'word' && seg.text === word && seg.lemma === lemma) {
            if (matchCount === wordOccurrence) {
              return i;
            }
            matchCount++;
          }
        }
      }

      // 对于 space/punctuation，遍历段落中所有非 .word 非 .annotation 非 .sentence-annotation 的 span
      const childSpans: HTMLElement[] = [];
      const walk = (el: HTMLElement) => {
        for (const child of Array.from(el.children)) {
          const c = child as HTMLElement;
          if (c.classList?.contains('annotation') || c.classList?.contains('sentence-annotation')) continue;
          if (c.classList?.contains('word') || c.tagName === 'SPAN') {
            childSpans.push(c);
          }
        }
      };
      walk(paragraphEl);

      for (let i = 0; i < childSpans.length; i++) {
        if (childSpans[i] === targetEl || childSpans[i].contains(targetEl)) {
          return Math.min(i, para.segments.length - 1);
        }
      }

      return 0;
    };

    const startParaInfo = findParagraphEl(range.startContainer);
    const endParaInfo = findParagraphEl(range.endContainer);

    if (!startParaInfo || !endParaInfo) return;

    const startSegIdx = findSegmentIndex(range.startContainer, startParaInfo.el, startParaInfo.pIndex);
    const endSegIdx = findSegmentIndex(range.endContainer, endParaInfo.el, endParaInfo.pIndex);

    // 根据 segment 索引计算字符偏移
    const calcCharOffset = (pIndex: number, segIdx: number, isEnd: boolean): number => {
      const para = processedContent![pIndex];
      if (!para) return 0;
      let offset = 0;
      for (let i = 0; i < para.segments.length; i++) {
        if (i === segIdx) {
          if (isEnd) {
            offset += para.segments[i].text.length;
          }
          break;
        }
        offset += para.segments[i].text.length;
      }
      return offset;
    };

    const startCharIndex = calcCharOffset(startParaInfo.pIndex, startSegIdx, false);
    const endCharIndex = calcCharOffset(endParaInfo.pIndex, endSegIdx, true);

    if (onTextSelect) {
      onTextSelect({
        text: selectedText,
        startParagraphIndex: startParaInfo.pIndex,
        startCharIndex,
        endParagraphIndex: endParaInfo.pIndex,
        endCharIndex,
      });
    }
  }, [onTextSelect, processedContent]);

  /**
   * 仅在「指针/触摸结束」后同步选区到句子翻译浮层。
   * 不能用 document selectionchange：拖选过程中会触发父组件 setState → 正文重绘，
   * 系统选区尚未稳定，WebKit 会把 Range 纠正成「从锚点到块末/文末」。
   * 使用 window capture + 双 rAF，等浏览器完成选区更新后再读 Range。
   */
  useEffect(() => {
    let coalesce: ReturnType<typeof setTimeout> | null = null;

    const finalizeSelectionFromPointer = () => {
      if (coalesce) clearTimeout(coalesce);
      coalesce = setTimeout(() => {
        coalesce = null;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const sel = window.getSelection();
            const root = containerRef.current;
            if (!sel || sel.isCollapsed || !root) return;
            const anchor = sel.anchorNode;
            const focus = sel.focusNode;
            if (!anchor || !root.contains(anchor)) return;
            if (!focus || !root.contains(focus)) return;
            handleTextSelection();
          });
        });
      }, 0);
    };

    window.addEventListener("pointerup", finalizeSelectionFromPointer, true);
    window.addEventListener("mouseup", finalizeSelectionFromPointer, true);
    window.addEventListener("touchend", finalizeSelectionFromPointer, true);

    return () => {
      window.removeEventListener("pointerup", finalizeSelectionFromPointer, true);
      window.removeEventListener("mouseup", finalizeSelectionFromPointer, true);
      window.removeEventListener("touchend", finalizeSelectionFromPointer, true);
      if (coalesce) clearTimeout(coalesce);
    };
  }, [handleTextSelection]);

  // 计算滚动百分比
  const getScrollPercent = useCallback(() => {
    if (!containerRef.current) return 0;
    const el = containerRef.current;
    if (el.scrollHeight <= el.clientHeight) return el.scrollTop > 0 ? 100 : 0;
    // 保留4位小数，避免长文档精度丢失
    return parseFloat(((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100).toFixed(4));
  }, []);
  /** 视口顶部第一个可见段落 + 段内偏移比例 */
  const getFirstVisibleInfo = useCallback((): { index: number; offsetRatio: number } => {
    if (!containerRef.current) return { index: 0, offsetRatio: 0 };
    const scrollTop = containerRef.current.scrollTop;
    const clientHeight = containerRef.current.clientHeight;
    const viewportTop = scrollTop;
    const viewportBottom = scrollTop + clientHeight;

    const items = virtualizer.getVirtualItems();
    if (items.length === 0) return { index: 0, offsetRatio: 0 };

    for (const item of items) {
      const top = item.start;
      const bottom = item.start + item.size;
      const overlap = Math.min(bottom, viewportBottom) - Math.max(top, viewportTop);
      if (overlap > item.size * 0.3 || overlap > clientHeight * 0.1) {
        const offset = Math.max(0, scrollTop - top);
        const ratio = item.size > 0 ? offset / item.size : 0;
        return { index: item.index, offsetRatio: Math.min(ratio, 1) };
      }
    }

    return { index: items[0].index, offsetRatio: 0 };
  }, [virtualizer]);



  // Restore timers — declared before scroll listener so it can cancel them
  const hasRestoredRef = useRef(false);
  const isRestoringRef = useRef(false);
  const restoreTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cancelRestoreTimers = useCallback(() => {
    restoreTimersRef.current.forEach(clearTimeout);
    restoreTimersRef.current = [];
    isRestoringRef.current = false;
  }, []);

  // 监听滚动，更新进度
  const userHasScrolledRef = useRef(false);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let ticking = false;
    const onScroll = () => {
      if (!userHasScrolledRef.current && !isRestoringRef.current) {
        userHasScrolledRef.current = true;
        cancelRestoreTimers();
      }
      if (!ticking) {
        requestAnimationFrame(() => {
          const percent = getScrollPercent();
          setReadProgress(percent);
          if (onProgressChange && !isRestoringRef.current) {
            onProgressChange(percent);
          }
          if (onParagraphIndexChange && !isRestoringRef.current) {
            const info = getFirstVisibleInfo();
            onParagraphIndexChange(info.index, info.offsetRatio);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [getScrollPercent, onProgressChange, onParagraphIndexChange, getFirstVisibleInfo, cancelRestoreTimers]);

  useEffect(() => {
    userHasScrolledRef.current = false;
  }, [bookId]);

  // 手势翻页
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let direction: 'none' | 'horizontal' | 'vertical' = 'none';

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = Date.now();
      direction = 'none';
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (direction === 'vertical') return; // 已判定为垂直滚动，不干预

      const touch = e.touches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      // 首次判定方向（移动超过 10px 时）
      if (direction === 'none' && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          direction = 'horizontal';
        } else {
          direction = 'vertical';
          return;
        }
      }

      // 水平滑动时阻止默认滚动
      if (direction === 'horizontal') {
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (direction !== 'horizontal') return; // 只处理水平滑动

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - startX;
      const deltaTime = Date.now() - startTime;

      // 水平滑动 > 50px 且时间 < 800ms
      if (Math.abs(deltaX) > 50 && deltaTime < 800) {
        if (deltaX < 0) {
          // 左滑 → 下一页
          scrollReadingPage("next");
        } else {
          // 右滑 → 上一页
          scrollReadingPage("prev");
        }
        lastSwipeTimeRef.current = Date.now();
      }
    };

    if (!clickToTurnPage) return;
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [scrollReadingPage, clickToTurnPage]);

  // 跳转到段落（滚动方式）
  const jumpToParagraph = useCallback((paragraphIndex: number) => {
    if (!containerRef.current) return;
    if (paragraphIndex >= 0 && processedContent && paragraphIndex < processedContent.length) {
      virtualizer.scrollToIndex(paragraphIndex, { align: "start" });
    }
  }, [processedContent, virtualizer]);


  // 添加书签
  const addBookmarkFn = useCallback(() => {
    if (!containerRef.current || !contentRef.current || !bookId) return;
    
    const el = containerRef.current;
    const scrollRatio = el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight);
    const percent = getScrollPercent();
    
    // 获取当前可视区域第一个段落的文字作为预览
    const paragraphEls = contentRef.current.querySelectorAll('.paragraph');
    let preview = '';
    for (const pEl of paragraphEls) {
      const rect = (pEl as HTMLElement).getBoundingClientRect();
      const containerRect = el.getBoundingClientRect();
      if (rect.top >= containerRect.top && rect.top < containerRect.bottom) {
        preview = (pEl as HTMLElement).textContent?.substring(0, 50) || '';
        break;
      }
    }
    
    const bookmark: Bookmark = {
      id: `bm_${Date.now()}`,
      scrollRatio,
      percent,
      preview,
      createdAt: Date.now(),
    };
    
    const key = `book_${bookId}_bookmarks`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.push(bookmark);
    localStorage.setItem(key, JSON.stringify(existing));
    
    if (onAddBookmark) {
      onAddBookmark();
    }
  }, [bookId, getScrollPercent, onAddBookmark]);

  // 打开书籍时自动恢复上次滚动位置（只运行一次）
  useEffect(() => {
    hasRestoredRef.current = false;
    cancelRestoreTimers();
  }, [bookId, cancelRestoreTimers]);

  useEffect(() => {
    if (
      hasRestoredRef.current ||
      !containerRef.current ||
      !processedContent ||
      processedContent.length === 0
    ) {
      return;
    }

    if (initialParagraphIndex < 0 && initialScrollPercent <= 0) {
      return;
    }

    hasRestoredRef.current = true;
    isRestoringRef.current = true;

    const scheduleTimer = (fn: () => void, ms: number) => {
      const id = setTimeout(fn, ms);
      restoreTimersRef.current.push(id);
    };

    const findTargetParagraph = (): number => {
      if (!processedContent) return Math.max(0, initialParagraphIndex);

      if (initialParagraphText) {
        const savedText = initialParagraphText;
        const searchRadius = 200;
        const startSearch = Math.max(0, initialParagraphIndex - searchRadius);
        const endSearch = Math.min(processedContent.length, initialParagraphIndex + searchRadius);

        for (let i = startSearch; i < endSearch; i++) {
          const paraText = processedContent[i].segments.map((s) => s.text).join("").substring(0, 80);
          if (paraText === savedText) {
            return i;
          }
        }

        for (let i = 0; i < processedContent.length; i++) {
          const paraText = processedContent[i].segments.map((s) => s.text).join("").substring(0, 80);
          if (paraText === savedText) {
            return i;
          }
        }
      }

      return Math.max(0, initialParagraphIndex);
    };

    const applyParagraphOffset = (targetIndex: number) => {
      const el = containerRef.current;
      if (!el) return;
      const items = virtualizer.getVirtualItems();
      const targetItem = items.find(item => item.index === targetIndex);
      if (targetItem && initialParagraphOffsetRatio > 0) {
        el.scrollTop = targetItem.start + initialParagraphOffsetRatio * targetItem.size;
      }
    };

    const doRestore = () => {
      const el = containerRef.current;
      if (!el || !processedContent?.length) return;

      if (initialParagraphIndex >= 0) {
        const targetIndex = findTargetParagraph();

        // Phase 1
        if (initialScrollPercent > 0) {
          const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
          if (maxScroll > 0) {
            el.scrollTop = (initialScrollPercent / 100) * maxScroll;
          }
        }

        // Phase 2
        scheduleTimer(() => {
          virtualizer.scrollToIndex(targetIndex, { align: "start" });

          // Phase 3
          scheduleTimer(() => {
            applyParagraphOffset(targetIndex);
            cancelRestoreTimers();
          }, 300);
        }, 200);
        return;
      }

      // Fallback: percentage only
      if (initialScrollPercent > 0) {
        const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
        if (maxScroll > 0) {
          el.scrollTop = (initialScrollPercent / 100) * maxScroll;
        }
        cancelRestoreTimers();
      }
    };

    scheduleTimer(doRestore, 200);

    return cancelRestoreTimers;
  }, [initialParagraphIndex, initialParagraphText, initialParagraphOffsetRatio, initialScrollPercent, processedContent, virtualizer, cancelRestoreTimers]);




  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    jumpToParagraph,
    jumpToSearchResult: (result: { paragraphIndex: number; charIndex: number }) => {
      jumpToParagraph(result.paragraphIndex);
    },
    getScrollPercent,
    getFirstVisibleIndex: getFirstVisibleInfo,
    addBookmark: addBookmarkFn,
    restoreScrollPosition: (percent: number) => {
      const el = containerRef.current;
      if (!el) return;
      const ratio = percent / 100;
      const maxScroll = el.scrollHeight - el.clientHeight;
      el.scrollTop = maxScroll * ratio;
    },
    restoreByParagraphIndex: (index: number) => {
      virtualizer.scrollToIndex(index, { align: "start" });
    },
  }));



  if (processedContent && processedContent.length > 0) {
    const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
    const padLeft = isMobile
      ? `max(${MOBILE_READING_PADDING_HORIZONTAL}px, env(safe-area-inset-left, 0px))`
      : `${READING_PADDING_HORIZONTAL}px`;
    const padRight = isMobile
      ? `max(${MOBILE_READING_PADDING_HORIZONTAL}px, env(safe-area-inset-right, 0px))`
      : `${READING_PADDING_HORIZONTAL}px`;

    return (
      <div 
        ref={wrapperRef}
        className="reading-wrapper" 
        style={{ 
          backgroundColor,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* 阅读容器 - 滚动模式 */}
        <div 
          ref={containerRef}
          className="reading-container"
          onContextMenu={(e) => {
            e.preventDefault();
          }}
          onClick={(e) => {
            const selection = window.getSelection();
            if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) {
              return;
            }
            if (Date.now() - lastSwipeTimeRef.current < 400) return;

            // 任何模式下，点击单词/标注都不触发翻页（让 onWordClick 接管）
            const target = e.target as HTMLElement;
            const isWordOrAnnotation = !!(
              target.classList.contains('word') ||
              target.classList.contains('annotation') ||
              target.classList.contains('sentence-annotation') ||
              target.closest('.word') ||
              target.closest('.annotation') ||
              target.closest('.sentence-annotation')
            );
            if (isWordOrAnnotation) return;

            // 分页模式：点击空白区域才翻页
            if (clickToTurnPage) {
              const rect = containerRef.current?.getBoundingClientRect();
              if (!rect) return;
              const clickX = e.clientX - rect.left;
              const halfWidth = rect.width / 2;
              if (clickX < halfWidth) {
                scrollReadingPage("prev");
              } else {
                scrollReadingPage("next");
              }
            }
          }}
          style={{
            height: containerHeight,
            flex: "none",
            overflowY: clickToTurnPage ? "hidden" : "auto",
            overflowX: "hidden",
            position: "relative",
            padding: "0px",
            boxSizing: "border-box",
            WebkitOverflowScrolling: "touch",
            touchAction: clickToTurnPage ? "none" : "pan-y",
          }}
        >
          <div
            ref={contentRef}
            className="reader-content"
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const pIndex = virtualRow.index;
              const paragraph = processedContent[pIndex];
              return (
                <div
                  key={pIndex}
                  data-index={pIndex}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                    paddingLeft: padLeft,
                    paddingRight: padRight,
                  }}
                >
                  <MemoizedParagraph
                    paragraph={paragraph}
                    pIndex={pIndex}
                    onWordClick={onWordClick}
                    onWordDoubleClick={onWordDoubleClick}
                    annotations={annotations}
                    annotationColor={annotationColor}
                    searchQuery={searchQuery}
                    isCurrentSearchResult={
                      searchResults.length > 0 &&
                      searchResults[currentSearchIndex]?.paragraphIndex === pIndex
                    }
                    highlightBg={highlightBg}
                    isDarkMode={isDarkMode}
                    cefrColorPalette={cefrColorPalette}
                    annotationDisplayMode={annotationDisplayMode}
                    annotationFontSize={annotationFontSize}
                    sentenceAnnotations={sentenceAnnotations}
                    onRemoveSentenceAnnotation={onRemoveSentenceAnnotation}
                    onRemoveAnnotation={onRemoveAnnotation}
                    ttsSentenceId={ttsSentenceId}
                    ttsPlaying={ttsPlaying}
                  />
                </div>
              );
            })}
          </div>

        </div>

        {/* 底部遮罩：隐藏分页模式下的半行文字 */}
        <div
          ref={bottomMaskRef}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            zIndex: 5,
            pointerEvents: "none",
            display: "none",
          }}
        />

        {/* 左下角阅读进度 */}
        <div style={{
          position: "fixed",
          bottom: 12,
          left: 16,
          backgroundColor: isDarkMode ? "rgba(30,30,46,0.85)" : "rgba(255,255,255,0.85)",
          color: isDarkMode ? "#888" : "#999",
          fontSize: "12px",
          padding: "4px 8px",
          borderRadius: "4px",
          zIndex: 100,
          pointerEvents: "none",
          backdropFilter: "blur(4px)",
        }}>
          {readProgress.toFixed(2)}%
        </div>

        <style jsx>{`
          .reading-wrapper {
            height: 100vh;
            position: relative;
          }

          .reading-container {
            flex: 1;
          }

          .reader-content {
            font-size: ${fontSize}px;
            line-height: ${lineHeight};
            color: ${textColor};
            font-family: ${fontFamilyCss || 'Georgia, "Times New Roman", serif'};
            text-align: justify;
            -webkit-touch-callout: none;
            -webkit-user-select: text;
            user-select: text;
          }

          .reader-content :global(.paragraph) {
            margin-bottom: 16px;
            margin-top: 0px;
            -webkit-user-select: text;
            user-select: text;
          }

          .reader-content :global(.word) {
            cursor: pointer;
            transition: color 0.15s;
          }

          .reader-content :global(.word:hover) {
            color: #4A90D9;
          }

          .reader-content :global(.annotation) {
            font-family: "Microsoft YaHei", "微软雅黑", sans-serif;
          }

          .reader-content :global(.annotated-unit) {
            position: relative;
            display: inline-block;
            vertical-align: baseline;
          }

          .reader-content :global(.annotation-above) {
            position: absolute;
            left: 50%;
            bottom: 100%;
            transform: translateX(-50%);
            margin-bottom: 2px;
            line-height: 1.15;
            white-space: nowrap;
            font-family: "Microsoft YaHei", "微软雅黑", sans-serif;
            pointer-events: auto;
          }

          @media (max-width: 768px) {
            .reading-wrapper {
              height: 100dvh !important;
            }
            /* 隐藏纵向滚动条占位，避免右侧多出一条空隙导致视觉不居中 */
            .reading-container {
              scrollbar-width: none;
              -ms-overflow-style: none;
            }
            .reading-container::-webkit-scrollbar {
              width: 0;
              height: 0;
              background: transparent;
            }
            .reader-content {
              text-align: justify;
              word-break: break-word;
              overflow-wrap: break-word;
              -webkit-hyphens: auto;
              hyphens: auto;
            }
          }
        `}</style>
      </div>
    );
  }

  // 无内容时显示原文
  return (
    <div className="reading-wrapper" style={{ backgroundColor, minHeight: '100vh' }}>
      <div 
        className="reading-area"
        style={{
          padding: `40px ${READING_PADDING_HORIZONTAL}px`,
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
            fontFamily: fontFamilyCss || "Georgia, \"Times New Roman\", serif",
          }}
        >
          {text}
        </div>
      </div>
      <style jsx>{`
        .text-content {
          font-family: ${fontFamilyCss || 'Georgia, "Times New Roman", serif'};
        }
      `}</style>
    </div>
  );
});
