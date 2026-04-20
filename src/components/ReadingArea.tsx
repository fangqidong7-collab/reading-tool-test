"use client";

import React, { useCallback, useRef, useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { ProcessedContent, SentenceAnnotation } from "@/hooks/useBookshelf";
import { useVirtualizer } from '@tanstack/react-virtual';

// Layout constants
const READING_PADDING_HORIZONTAL = 32;
const MOBILE_READING_PADDING_HORIZONTAL = 12;
const MOBILE_BREAKPOINT = 768;
/** End padding inside scroll area (footer row below handles progress; keep modest tail spacing) */
const READING_CONTENT_PADDING_BOTTOM = 32;
const PAGE_TURN_EDGE_EPS = 3;

/** CSS Custom Highlight name — only paints segment spans, never `.annotation` insertions between words */
const SENTENCE_SEL_HIGHLIGHT_NAME = 'english-reader-sentence-sel';

export function clearSentenceSelectionHighlight(): void {
  try {
    if (typeof CSS !== 'undefined' && CSS.highlights && typeof CSS.highlights.delete === 'function') {
      CSS.highlights.delete(SENTENCE_SEL_HIGHLIGHT_NAME);
    }
  } catch {
    /* noop */
  }
}

function buildRangesForParagraphPlainInterval(
  paragraphEl: HTMLElement,
  startChar: number,
  endChar: number
): Range[] {
  const ranges: Range[] = [];
  paragraphEl.querySelectorAll<HTMLElement>('[data-char-start]').forEach((span) => {
    const cs = parseInt(span.getAttribute('data-char-start') || '', 10);
    const ce = parseInt(span.getAttribute('data-char-end') || '', 10);
    if (Number.isNaN(cs) || Number.isNaN(ce)) return;
    const lo = Math.max(startChar, cs);
    const hi = Math.min(endChar, ce);
    if (lo >= hi) return;
    const tn = span.firstChild;
    if (!tn || tn.nodeType !== Node.TEXT_NODE) return;
    try {
      const r = document.createRange();
      r.setStart(tn, lo - cs);
      r.setEnd(tn, hi - cs);
      ranges.push(r);
    } catch {
      /* skip */
    }
  });
  return ranges;
}

function applySentenceSelectionHighlight(
  pc: ProcessedContent,
  contentRoot: HTMLElement,
  startP: number,
  startC: number,
  endP: number,
  endC: number
): { ok: boolean; rangeCount: number } {
  clearSentenceSelectionHighlight();
  const HL =
    typeof globalThis !== 'undefined'
      ? (globalThis as unknown as { Highlight?: typeof Highlight }).Highlight
      : undefined;
  if (
    typeof CSS === 'undefined' ||
    !HL ||
    !CSS.highlights ||
    typeof CSS.highlights.set !== 'function'
  ) {
    return { ok: false, rangeCount: 0 };
  }
  const allRanges: Range[] = [];
  for (let p = startP; p <= endP; p++) {
    const paraEl = contentRoot.querySelector(`[data-index="${p}"] .paragraph`) as HTMLElement | null;
    if (!paraEl) continue;
    const lo = p === startP ? startC : 0;
    const hi = p === endP ? endC : paragraphPlainLenFromPc(pc, p);
    allRanges.push(...buildRangesForParagraphPlainInterval(paraEl, lo, hi));
  }
  if (allRanges.length === 0) return { ok: false, rangeCount: 0 };
  try {
    const h = new HL(...allRanges);
    CSS.highlights.set(SENTENCE_SEL_HIGHLIGHT_NAME, h);
    return { ok: true, rangeCount: allRanges.length };
  } catch {
    return { ok: false, rangeCount: 0 };
  }
}

/** Max plain-text offset in paragraph (exclusive upper bound) */
function getParagraphPlainLength(paragraphEl: HTMLElement): number {
  let maxEnd = 0;
  paragraphEl.querySelectorAll<HTMLElement>("[data-char-end]").forEach((el) => {
    const v = parseInt(el.getAttribute("data-char-end") || "", 10);
    if (!Number.isNaN(v)) maxEnd = Math.max(maxEnd, v);
  });
  return maxEnd;
}

/** Plain characters contributed by one direct child of .paragraph */
function plainCharsInParagraphChild(el: HTMLElement): number {
  const spans = el.querySelectorAll<HTMLElement>("[data-char-start]");
  if (spans.length === 0) return 0;
  let sum = 0;
  spans.forEach((s) => {
    const ds = parseInt(s.getAttribute("data-char-start") || "0", 10);
    const de = parseInt(s.getAttribute("data-char-end") || "0", 10);
    if (!Number.isNaN(ds) && !Number.isNaN(de)) sum += de - ds;
  });
  return sum;
}

function paragraphPlainLenFromPc(pc: ProcessedContent, pi: number): number {
  const p = pc[pi];
  if (!p) return 0;
  return p.segments.map((s) => s.text).join("").length;
}

function extractPlainBetween(
  processedContent: ProcessedContent,
  startP: number,
  startC: number,
  endP: number,
  endC: number
): string {
  if (startP === endP) {
    const para = processedContent[startP];
    if (!para) return "";
    const full = para.segments.map((s) => s.text).join("");
    return full.slice(startC, endC);
  }
  const parts: string[] = [];
  const first = processedContent[startP];
  if (first) {
    const full = first.segments.map((s) => s.text).join("");
    parts.push(full.slice(startC));
  }
  for (let p = startP + 1; p < endP; p++) {
    const para = processedContent[p];
    if (para) parts.push(para.segments.map((s) => s.text).join(""));
  }
  const last = processedContent[endP];
  if (last) {
    const full = last.segments.map((s) => s.text).join("");
    parts.push(full.slice(0, endC));
  }
  return parts.join("\n\n");
}

/** Keep selection endpoints on plain-text spans (.word / punctuation), not .annotation overlays */
function clampSelectionBoundaryToPlainSpan(
  paragraphEl: HTMLElement,
  node: Node,
  offset: number
): { node: Node; offset: number } {
  let el: HTMLElement | null =
    node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement);
  while (el && el !== paragraphEl) {
    if (el.classList?.contains("annotation") || el.classList?.contains("sentence-annotation")) {
      const prev = el.previousElementSibling;
      if (prev?.classList?.contains("word")) {
        const tn = prev.firstChild;
        if (tn && tn.nodeType === Node.TEXT_NODE) {
          const len = tn.textContent?.length ?? 0;
          return { node: tn, offset: len };
        }
      }
      break;
    }
    el = el.parentElement;
  }
  return { node, offset };
}

/** Character offset in paragraph plain text (matches processed segments joined), using data-char-start spans */
function plainCharOffsetFromBoundary(
  paragraphEl: HTMLElement,
  boundaryNode: Node,
  boundaryOffset: number
): number | null {
  // 选区落在「段落节点 + 子节点下标」时（常见于拖到段尾/段首），必须按子树累计字数
  if (boundaryNode === paragraphEl && boundaryNode.nodeType === Node.ELEMENT_NODE) {
    const pe = boundaryNode as HTMLElement;
    const kids = pe.children;
    const idx = boundaryOffset;
    if (idx <= 0) return 0;
    if (idx >= kids.length) return getParagraphPlainLength(pe);
    let sum = 0;
    for (let i = 0; i < idx; i++) {
      sum += plainCharsInParagraphChild(kids[i] as HTMLElement);
    }
    return sum;
  }

  const { node, offset } = clampSelectionBoundaryToPlainSpan(paragraphEl, boundaryNode, boundaryOffset);
  let scan: HTMLElement | null =
    node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement);
  while (scan && scan !== paragraphEl) {
    const ds = scan.getAttribute("data-char-start");
    if (ds !== null) {
      const base = parseInt(ds, 10);
      const r = document.createRange();
      r.setStart(scan, 0);
      r.setEnd(node, offset);
      return base + r.toString().length;
    }
    scan = scan.parentElement;
  }
  return null;
}

/** Collect text line boxes from visible virtualized paragraphs (viewport-relative rects). */
function gatherVisibleParagraphLineRects(
  contentRoot: HTMLElement,
  scrollEl: HTMLElement,
  virtualIndices: readonly { index: number }[]
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
      if (r.bottom < cRect.top || r.top > cRect.bottom) continue;
      out.push(r);
    }
  }
  return out;
}

function computeSnappedPageScrollTop(
  scrollEl: HTMLElement,
  contentRoot: HTMLElement,
  virtualIndices: readonly { index: number }[],
  direction: "next" | "prev",
  pageStepPx: number
): number {
  const S = scrollEl.scrollTop;
  const maxS = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);
  const cRect = scrollEl.getBoundingClientRect();
  const edge = PAGE_TURN_EDGE_EPS;
  const rects = gatherVisibleParagraphLineRects(contentRoot, scrollEl, virtualIndices);

  if (direction === "next") {
    let crossingBottom: DOMRect | null = null;
    for (const r of rects) {
      if (r.top < cRect.bottom - edge && r.bottom > cRect.bottom - edge) {
        if (!crossingBottom || r.top > crossingBottom.top) crossingBottom = r;
      }
    }

    let T: number;
    if (crossingBottom) {
      const snapped = S + (crossingBottom.top - cRect.top);
      T = snapped > S + 0.5 ? snapped : Math.min(S + pageStepPx, maxS);
    } else {
      T = Math.min(S + pageStepPx, maxS);
    }
    if (T <= S && maxS > S) {
      T = Math.min(S + pageStepPx, maxS);
    }
    return Math.min(Math.max(0, T), maxS);
  }

  let crossingTop: DOMRect | null = null;
  for (const r of rects) {
    if (r.top < cRect.top + edge && r.bottom > cRect.top + edge) {
      if (!crossingTop || r.top < crossingTop.top) crossingTop = r;
    }
  }

  let T: number;
  if (crossingTop) {
    T = S - pageStepPx + (crossingTop.top - cRect.top);
  } else {
    T = S - pageStepPx;
  }
  T = Math.max(0, Math.min(T, maxS));
  if (S > 0 && T >= S) {
    T = Math.max(0, S - pageStepPx);
  }
  return T;
}

// Ref type
export interface ReadingAreaRef {
  jumpToParagraph: (paragraphIndex: number) => void;
  jumpToSearchResult: (result: { paragraphIndex: number; charIndex: number }) => void;
  getScrollPercent: () => number;
  getFirstVisibleIndex: () => number;
  addBookmark: () => void;
  restoreScrollPosition: (percent: number) => void;
  restoreByParagraphIndex: (index: number) => void;
  /** Clear CSS Custom Highlight used for sentence selection (does not affect native selection) */
  clearSentenceHighlight: () => void;
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
type Annotations = Record<string, { root: string; meaning: string; pos: string; count: number }>;

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
  sentenceAnnotations?: SentenceAnnotation[];
  onRemoveSentenceAnnotation?: (id: string) => void;
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
  sentenceAnnotations = [],
  onRemoveSentenceAnnotation,
}: ParagraphProps) => {
  const handleClick = useCallback((e: React.MouseEvent) => {
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

  // Build text content for search matching
  const fullText = paragraph.segments.map(s => s.text).join('');

  // Compute segment character offsets
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

  return (
    <p 
      className={`paragraph ${isHeading ? 'heading-paragraph' : ''} ${isCurrentSearchResult ? 'search-highlight' : ''}`}
      data-paragraph-index={pIndex}
      data-heading-level={isHeading ? headingLevel : undefined}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      style={isCurrentSearchResult ? { backgroundColor: highlightBg } : (isHeading ? getHeadingStyles() : undefined)}
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
              <span
                style={hasUnderline ? getUnderlineStyle() : undefined}
                data-char-start={segCharStart}
                data-char-end={segCharStart + segment.text.length}
              >
                {segment.text}
              </span>
              {showTranslation && matchedSA && (
                <span
                  className="sentence-annotation"
                  title={`点击删除翻译标注\n原文: ${matchedSA.originalText}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onRemoveSentenceAnnotation) {
                      onRemoveSentenceAnnotation(matchedSA.id);
                    }
                  }}
                  style={{
                    color: annotationColor,
                    fontSize: '0.75em',
                    fontFamily: '"Microsoft YaHei", "微软雅黑", sans-serif',
                    cursor: 'pointer',
                    marginLeft: '2px',
                  }}
                >
                  【{matchedSA.translation}】
                </span>
              )}
            </React.Fragment>
          );
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
              data-char-start={segCharStart}
              data-char-end={segCharStart + segment.text.length}
              style={hasUnderline ? getUnderlineStyle() : undefined}
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
                  ...(hasUnderline ? getUnderlineStyle() : {}),
                }}
              >
                ({annotation.meaning})
              </span>
            )}
            {showTranslation && matchedSA && (
              <span
                className="sentence-annotation"
                title={`点击删除翻译标注\n原文: ${matchedSA.originalText}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onRemoveSentenceAnnotation) {
                    onRemoveSentenceAnnotation(matchedSA.id);
                  }
                }}
                style={{
                  color: annotationColor,
                  fontSize: '0.75em',
                  fontFamily: '"Microsoft YaHei", "微软雅黑", sans-serif',
                  cursor: 'pointer',
                  marginLeft: '2px',
                }}
              >
                【{matchedSA.translation}】
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
    sentenceAnnotations?: SentenceAnnotation[];
    onRemoveSentenceAnnotation?: (id: string) => void;
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
    sentenceAnnotations?: SentenceAnnotation[];
    onRemoveSentenceAnnotation?: (id: string) => void;
  }
) {
  if (prev.pIndex !== next.pIndex) return false;
  if (prev.onWordClick !== next.onWordClick) return false;
  if (prev.annotationColor !== next.annotationColor) return false;
  if (prev.searchQuery !== next.searchQuery) return false;
  if (prev.isCurrentSearchResult !== next.isCurrentSearchResult) return false;
  if (prev.highlightBg !== next.highlightBg) return false;
  if (prev.isDarkMode !== next.isDarkMode) return false;
  if (prev.onWordDoubleClick !== next.onWordDoubleClick) return false;
  if (prev.sentenceAnnotations !== next.sentenceAnnotations) return false;
  if (prev.onRemoveSentenceAnnotation !== next.onRemoveSentenceAnnotation) return false;
  
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
  fontSize?: number;
  lineHeight?: number;
  textColor?: string;
  backgroundColor?: string;
  annotationColor?: string;
  annotationFontSize?: number;
  highlightBg?: string;
  highlightBgHover?: string;
  isDarkMode?: boolean;
  headerVisible?: boolean;
  searchQuery?: string;
  searchResults?: Array<{ paragraphIndex: number; charIndex: number }>;
  currentSearchIndex?: number;
  bookId?: string;
  onProgressChange?: (percent: number) => void;
  onParagraphIndexChange?: (index: number) => void;
  onWordDoubleClick?: (word: string, lemma: string, event: React.MouseEvent) => void;
  onAddBookmark?: () => void;
  initialScrollPercent?: number;
  initialParagraphIndex?: number;
  initialParagraphText?: string;
  pageTurnRatio?: number;
  onTextSelect?: (selection: { text: string; startParagraphIndex: number; endParagraphIndex: number; startCharIndex: number; endCharIndex: number }) => void;
  sentenceAnnotations?: SentenceAnnotation[];
  onRemoveSentenceAnnotation?: (id: string) => void;
  clickToTurnPage?: boolean;
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
  highlightBg = "#FFEB3B",
  highlightBgHover = "#FFD700",
  isDarkMode = false,
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
  pageTurnRatio = 1,
  onTextSelect,
  sentenceAnnotations = [],
  onRemoveSentenceAnnotation,
  clickToTurnPage = false,

}: ReadingAreaProps, ref: React.Ref<ReadingAreaRef>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [readProgress, setReadProgress] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastSwipeTimeRef = useRef(0);

  const virtualizer = useVirtualizer({
    count: processedContent ? processedContent.length : 0,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 80,
    overscan: 20,
  });

  /** Turbopack/CSS parser rejects `::highlight()` in globals.css — inject so the browser parses it */
  useEffect(() => {
    const id = 'english-reader-sentence-highlight-style';
    if (typeof document === 'undefined') return;
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `::highlight(${SENTENCE_SEL_HIGHLIGHT_NAME}) { background-color: rgba(74, 144, 217, 0.22); }`;
    document.head.appendChild(style);
    return () => {
      document.getElementById(id)?.remove();
    };
  }, []);

  const scrollReadingPage = useCallback(
    (direction: "next" | "prev") => {
      const el = containerRef.current;
      const content = contentRef.current;
      if (!el) return;

      const pageStepPx = el.clientHeight * pageTurnRatio;
      const maxS = Math.max(0, el.scrollHeight - el.clientHeight);

      if (!processedContent?.length || !content) {
        const delta = direction === "next" ? pageStepPx : -pageStepPx;
        el.scrollTo({
          top: Math.min(maxS, Math.max(0, el.scrollTop + delta)),
          behavior: "smooth",
        });
        return;
      }

      const items = virtualizer.getVirtualItems();
      if (items.length === 0) {
        const delta = direction === "next" ? pageStepPx : -pageStepPx;
        el.scrollTo({
          top: Math.min(maxS, Math.max(0, el.scrollTop + delta)),
          behavior: "smooth",
        });
        return;
      }

      const target = computeSnappedPageScrollTop(el, content, items, direction, pageStepPx);
      el.scrollTo({ top: target, behavior: "smooth" });
    },
    [pageTurnRatio, processedContent, virtualizer]
  );

  // 音量键翻页
  useEffect(() => {
    // 方法1：监听 keydown（部分安卓浏览器会把音量键映射为 keydown 事件）
    const handleKeyDown = (e: KeyboardEvent) => {
      // AudioVolumeUp / AudioVolumeDown 是标准键名
      // VolumeUp / VolumeDown 是某些浏览器的旧键名
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
  }, [scrollReadingPage]);

  // 文本选择功能 - 句子翻译（偏移量与 processedContent 一致；修正浏览器「拖尾」选区）
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return;

    const container = containerRef.current;
    if (!container) return;

    if (!processedContent) return;

    const range = selection.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) return;

    // #region agent log
    {
      const ep = range.endContainer as Node;
      const isEndPara =
        ep.nodeType === Node.ELEMENT_NODE &&
        (ep as HTMLElement).classList?.contains('paragraph');
      const kidsLen =
        isEndPara ? (ep as HTMLElement).children.length : -1;
      fetch('http://127.0.0.1:7255/ingest/7d7c023a-6e5d-4158-bc13-c8ca1b19f6f9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bfc262'},body:JSON.stringify({sessionId:'bfc262',location:'ReadingArea.tsx:handleTextSelection:rawRange',message:'native range before offset calc',data:{applyingSkipped:false,startN:(range.startContainer as Node).nodeName,endN:ep.nodeName,startOff:range.startOffset,endOff:range.endOffset,isEndParagraph:isEndPara,endOffEqNumChildren:isEndPara&&kidsLen===range.endOffset,childrenLen:kidsLen,rangeLen:range.toString().length,rangeWordCount:range.toString().trim().split(/\s+/).filter(Boolean).length},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    }
    // #endregion

    const findParagraphEl = (node: Node): { el: HTMLElement; pIndex: number } | null => {
      let el: HTMLElement | null = node.nodeType === Node.TEXT_NODE ? node.parentElement : node as HTMLElement;
      while (el && !el.classList?.contains("paragraph")) {
        el = el.parentElement;
      }
      if (!el) return null;
      const pIndex = parseInt(el.getAttribute("data-paragraph-index") || "-1", 10);
      if (pIndex < 0) return null;
      return { el, pIndex };
    };

    const startParaInfo = findParagraphEl(range.startContainer);
    const endParaInfo = findParagraphEl(range.endContainer);
    if (!startParaInfo || !endParaInfo) return;

    let startCharIndex = plainCharOffsetFromBoundary(
      startParaInfo.el,
      range.startContainer,
      range.startOffset
    );
    let endCharIndex = plainCharOffsetFromBoundary(
      endParaInfo.el,
      range.endContainer,
      range.endOffset
    );

    if (startCharIndex === null || endCharIndex === null) return;

    // #region agent log
    fetch('http://127.0.0.1:7255/ingest/7d7c023a-6e5d-4158-bc13-c8ca1b19f6f9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bfc262'},body:JSON.stringify({sessionId:'bfc262',location:'ReadingArea.tsx:handleTextSelection:afterPlainOffset',message:'computed char offsets pre-reorder',data:{startCharIndex,endCharIndex,startP0:startParaInfo.pIndex,endP0:endParaInfo.pIndex},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
    // #endregion

    let startP = startParaInfo.pIndex;
    let endP = endParaInfo.pIndex;
    let startC = startCharIndex;
    let endC = endCharIndex;

    if (startP > endP || (startP === endP && endC < startC)) {
      const tP = startP;
      startP = endP;
      endP = tP;
      const tC = startC;
      startC = endC;
      endC = tC;
    }

    const contentRoot =
      (container.querySelector(".reader-content") as HTMLElement | null) ?? container;
    const startScrollEl = contentRoot.querySelector(
      `[data-index="${startP}"] .paragraph`
    ) as HTMLElement | null;
    const endScrollEl = contentRoot.querySelector(
      `[data-index="${endP}"] .paragraph`
    ) as HTMLElement | null;

    const endLenDom = endScrollEl ? getParagraphPlainLength(endScrollEl) : paragraphPlainLenFromPc(processedContent, endP);
    endC = Math.min(endC, endLenDom);
    if (startP === endP) {
      startC = Math.max(0, Math.min(startC, endC));
    }

    const plainSelected = extractPlainBetween(processedContent, startP, startC, endP, endC).trim();
    // #region agent log
    fetch('http://127.0.0.1:7255/ingest/7d7c023a-6e5d-4158-bc13-c8ca1b19f6f9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bfc262'},body:JSON.stringify({sessionId:'bfc262',location:'ReadingArea.tsx:handleTextSelection:afterClamp',message:'final indices and plain slice',data:{startP,endP,startC,endC,endLenDom,plainLen:plainSelected.length,plainWords:plainSelected.split(/\s+/).filter(Boolean).length,plainPreview:plainSelected.slice(0,160)},timestamp:Date.now(),hypothesisId:'H5'})}).catch(()=>{});
    // #endregion
    if (plainSelected.split(/\s+/).filter(Boolean).length < 2) {
      clearSentenceSelectionHighlight();
      return;
    }

    requestAnimationFrame(() => {
      const hl = applySentenceSelectionHighlight(
        processedContent,
        contentRoot,
        startP,
        startC,
        endP,
        endC
      );
      // #region agent log
      fetch('http://127.0.0.1:7255/ingest/7d7c023a-6e5d-4158-bc13-c8ca1b19f6f9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bfc262'},body:JSON.stringify({sessionId:'bfc262',location:'ReadingArea.tsx:applySentenceSelectionHighlight',message:'CSS highlight applied (no annotation bleed)',data:{ok:hl.ok,rangeCount:hl.rangeCount,nativeSelLenAfterClear:hl.ok?(typeof window !== 'undefined'?((window.getSelection()?.toString().length)??-1):-1):undefined},timestamp:Date.now(),hypothesisId:'H3-post'})}).catch(()=>{});
      // #endregion
      if (hl.ok) {
        window.getSelection()?.removeAllRanges();
      }
    });

    if (onTextSelect) {
      onTextSelect({
        text: plainSelected,
        startParagraphIndex: startP,
        startCharIndex: startC,
        endParagraphIndex: endP,
        endCharIndex: endC,
      });
    }
  }, [onTextSelect, processedContent]);

  // 仅在_pointer 释放后_再处理选区：不在 selectionchange 里弹出（否则拖选中途就会出翻译窗）
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let finalizeTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleFinalizeSelection = () => {
      if (finalizeTimer) clearTimeout(finalizeTimer);
      finalizeTimer = setTimeout(() => {
        finalizeTimer = null;
        handleTextSelection();
      }, 150);
    };

    /** 捕获阶段：手指/鼠标松开后 WebKit 才稳定 selection */
    const onPointerUpCapture = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return;
      try {
        const r = sel.getRangeAt(0);
        if (!container.contains(r.commonAncestorContainer)) return;
      } catch {
        return;
      }
      scheduleFinalizeSelection();
    };

    document.addEventListener("pointerup", onPointerUpCapture, true);

    /** 少数环境无 PointerEvent 或行为异常时兜底 */
    const fallbackEnd = () => scheduleFinalizeSelection();
    container.addEventListener("touchend", fallbackEnd, { passive: true });
    container.addEventListener("mouseup", fallbackEnd);

    return () => {
      document.removeEventListener("pointerup", onPointerUpCapture, true);
      container.removeEventListener("touchend", fallbackEnd);
      container.removeEventListener("mouseup", fallbackEnd);
      if (finalizeTimer) clearTimeout(finalizeTimer);
    };
  }, [handleTextSelection]);

  // 计算滚动百分比
  const getScrollPercent = useCallback(() => {
    if (!containerRef.current) return 0;
    const el = containerRef.current;
    if (el.scrollHeight <= el.clientHeight) return 100;
    // 保留4位小数，避免长文档精度丢失
    return parseFloat(((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100).toFixed(4));
  }, []);
  // 获取当前第一个可见段落的索引
const getFirstVisibleIndex = useCallback(() => {
    if (!containerRef.current) return 0;
    const scrollTop = containerRef.current.scrollTop;
    const items = virtualizer.getVirtualItems();
    if (items.length === 0) return 0;
    
    // 找到第一个 start 位置 >= scrollTop 的段落，才是真正可见的
    for (const item of items) {
      if (item.start + item.size > scrollTop) {
        return item.index;
      }
    }
    return items[0].index;
}, [virtualizer]);



  // 监听滚动，更新进度
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const percent = getScrollPercent();
          setReadProgress(percent);
          if (onProgressChange) {
            onProgressChange(percent);
          }
          if (onParagraphIndexChange) {
            onParagraphIndexChange(getFirstVisibleIndex());
          }
          ticking = false;
        });
        ticking = true;
      }
    };


    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [getScrollPercent, onProgressChange, onParagraphIndexChange, getFirstVisibleIndex]);

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

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [scrollReadingPage]);

  // 跳转到段落（滚动方式）
  const jumpToParagraph = useCallback((paragraphIndex: number) => {
    if (!containerRef.current) return;
    if (paragraphIndex >= 0 && processedContent && paragraphIndex < processedContent.length) {
      virtualizer.scrollToIndex(paragraphIndex, { align: 'start' });
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

  // 打开书籍时自动恢复上次滚动位置
  // 恢复滚动位置
  // 恢复滚动位置
  const hasRestoredRef = useRef(false);
  
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

    const doRestore = () => {
      // 核心策略：用保存的段落文字在 processedContent 中搜索，找到真实索引
      let targetIndex = initialParagraphIndex;

      if (initialParagraphText && processedContent) {
        // 在 processedContent 中查找匹配的段落
        const savedText = initialParagraphText;
        
        // 先在保存索引附近搜索（前后200段范围）
        const searchRadius = 200;
        const startSearch = Math.max(0, initialParagraphIndex - searchRadius);
        const endSearch = Math.min(processedContent.length, initialParagraphIndex + searchRadius);
        
        let foundIndex = -1;
        for (let i = startSearch; i < endSearch; i++) {
          const paraText = processedContent[i].segments.map(s => s.text).join('').substring(0, 80);
          if (paraText === savedText) {
            foundIndex = i;
            break;
          }
        }

        // 如果附近没找到，全文搜索
        if (foundIndex === -1) {
          for (let i = 0; i < processedContent.length; i++) {
            const paraText = processedContent[i].segments.map(s => s.text).join('').substring(0, 80);
            if (paraText === savedText) {
              foundIndex = i;
              break;
            }
          }
        }

        if (foundIndex >= 0) {
          targetIndex = foundIndex;
          console.log('ReadingArea 文字匹配成功: 保存索引=', initialParagraphIndex, ', 实际索引=', foundIndex);
        } else {
          console.log('ReadingArea 文字匹配失败，使用原始索引:', initialParagraphIndex);
        }
      }

      // 用 scrollToIndex 跳转到目标段落，多次修正
      if (targetIndex >= 0) {
        virtualizer.scrollToIndex(targetIndex, { align: 'start' });
        console.log('ReadingArea 段落恢复 第1次:', targetIndex);

        const corrections = [300, 700, 1500];
        corrections.forEach((delay) => {
          setTimeout(() => {
            virtualizer.scrollToIndex(targetIndex, { align: 'start' });
            console.log(`ReadingArea 段落修正(${delay}ms):`, targetIndex);
          }, delay);
        });
      } else if (initialScrollPercent > 0) {
        // 回退到百分比
        const el = containerRef.current;
        if (el) {
          const maxScroll = el.scrollHeight - el.clientHeight;
          if (maxScroll > 0) {
            el.scrollTop = (initialScrollPercent / 100) * maxScroll;
          }
        }
      }
    };

    setTimeout(doRestore, 200);

  }, [initialParagraphIndex, initialParagraphText, initialScrollPercent, processedContent, virtualizer]);

  useEffect(() => {
    hasRestoredRef.current = false;
    clearSentenceSelectionHighlight();
  }, [bookId]);




  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    jumpToParagraph,
    jumpToSearchResult: (result: { paragraphIndex: number; charIndex: number }) => {
      jumpToParagraph(result.paragraphIndex);
    },
    getScrollPercent,
    getFirstVisibleIndex,
    addBookmark: addBookmarkFn,
    restoreScrollPosition: (percent: number) => {
      const el = containerRef.current;
      if (!el) return;
      const ratio = percent / 100;
      const maxScroll = el.scrollHeight - el.clientHeight;
      el.scrollTop = maxScroll * ratio;
    },
    restoreByParagraphIndex: (index: number) => {
      virtualizer.scrollToIndex(index, { align: 'start' });
    },
    clearSentenceHighlight: () => {
      clearSentenceSelectionHighlight();
    },
  }));



  if (processedContent && processedContent.length > 0) {
    const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
    const currentHorizPadding = isMobile ? MOBILE_READING_PADDING_HORIZONTAL : READING_PADDING_HORIZONTAL;

    return (
      <div 
        className="reading-wrapper" 
        style={{ 
          backgroundColor,
          height: "100%",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* 上方：仅正文滚动区；下方：进度条单独一行，不与正文叠在同一层 */}
        <div 
          ref={containerRef}
          className="reading-container"
          onClick={(e) => {
            // ===== 如果有文字被选中，不翻页 =====
            const selection = window.getSelection();
            if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) {
              return;
            }

            // 滑动翻页后的防误触
            if (Date.now() - lastSwipeTimeRef.current < 400) return;

            // 点击单词/标注/翻译标注 不处理
            const target = e.target as HTMLElement;
            if (
              target.classList.contains('word') ||
              target.classList.contains('annotation') ||
              target.classList.contains('sentence-annotation') ||
              target.closest('.word') ||
              target.closest('.annotation') ||
              target.closest('.sentence-annotation')
            ) {
              return;
            }

            // 只在开启点击翻页时才处理
            if (!clickToTurnPage) return;

            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const clickX = e.clientX - rect.left;
            const halfWidth = rect.width / 2;
            const el = containerRef.current;
            if (!el) return;
            const vh = el.clientHeight;
            if (clickX < halfWidth) {
              el.scrollBy({ top: -(vh * pageTurnRatio), behavior: "smooth" });
            } else {
              el.scrollBy({ top: vh * pageTurnRatio, behavior: "smooth" });
            }
          }}
          style={{
            flex: 1,
            minHeight: 0,
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
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
              paddingBottom: READING_CONTENT_PADDING_BOTTOM,
              boxSizing: "content-box",
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
                    paddingLeft: `${currentHorizPadding}px`,
                    paddingRight: `${currentHorizPadding}px`,
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
                    sentenceAnnotations={sentenceAnnotations}
                    onRemoveSentenceAnnotation={onRemoveSentenceAnnotation}
                  />
                </div>
              );
            })}
          </div>

        </div>

        <div
          style={{
            flexShrink: 0,
            paddingLeft: 14,
            paddingRight: 14,
            paddingTop: 4,
            paddingBottom: "max(10px, env(safe-area-inset-bottom, 0px))",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              display: "inline-block",
              backgroundColor: isDarkMode ? "rgba(30,30,46,0.85)" : "rgba(255,255,255,0.85)",
              color: isDarkMode ? "#888" : "#999",
              fontSize: "12px",
              padding: "4px 8px",
              borderRadius: "4px",
              backdropFilter: "blur(4px)",
            }}
          >
            {readProgress.toFixed(2)}%
          </div>
        </div>

        <style jsx>{`
          .reading-wrapper {
            height: 100%;
            min-height: 0;
            position: relative;
          }

          .reading-container {
            flex: 1;
            min-height: 0;
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
            user-select: none;
            -webkit-user-select: none;
          }

          .reader-content :global(.sentence-annotation) {
            user-select: none;
            -webkit-user-select: none;
          }

          @media (max-width: 768px) {
            .reading-wrapper {
              height: 100%;
              min-height: 0;
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
            fontFamily: "Georgia, \"Times New Roman\", serif",
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
