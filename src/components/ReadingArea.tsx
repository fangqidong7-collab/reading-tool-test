"use client";

import React, { useCallback, useRef, useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { ProcessedContent, SentenceAnnotation } from "@/hooks/useBookshelf";
import { useVirtualizer } from "@tanstack/react-virtual";

// Layout constants
const HEADER_HEIGHT = 56;
const MOBILE_HEADER_HEIGHT = 48;
const READING_PADDING_HORIZONTAL = 32;
const MOBILE_READING_PADDING_HORIZONTAL = 12;
const MOBILE_BREAKPOINT = 768;
const MOBILE_TOP_GAP = 5;
const MOBILE_BOTTOM_SAFE_ZONE = 60;
const PAGE_TURN_EDGE_EPS = 3;

/** 收集当前虚拟列表可见段落的文字行框（用于点击翻页对齐）。 */
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
              <span style={hasUnderline ? getUnderlineStyle() : undefined}>
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

  useEffect(() => {
    const calcHeight = () => {
      const mobile = window.innerWidth <= MOBILE_BREAKPOINT;
      const headerH = mobile ? MOBILE_HEADER_HEIGHT : HEADER_HEIGHT;
      const PAGER_HEIGHT = 0;
      const h = mobile
        ? window.innerHeight - headerH - MOBILE_TOP_GAP - MOBILE_BOTTOM_SAFE_ZONE - PAGER_HEIGHT
        : window.innerHeight - headerH - PAGER_HEIGHT;
      setContainerHeight(Math.max(h, 200));
    };

    calcHeight();
    window.addEventListener('resize', calcHeight);
    return () => window.removeEventListener('resize', calcHeight);
  }, []);

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
    if (el.scrollHeight <= el.clientHeight) return 100;
    // 保留4位小数，避免长文档精度丢失
    return parseFloat(((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100).toFixed(4));
  }, []);
  const getFirstVisibleIndex = useCallback(() => {
    if (!containerRef.current) return 0;
    const scrollTop = containerRef.current.scrollTop;
    const items = virtualizer.getVirtualItems();
    if (items.length === 0) return 0;

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

      if (targetIndex >= 0) {
        virtualizer.scrollToIndex(targetIndex, { align: "start" });
        console.log("ReadingArea 段落恢复 第1次:", targetIndex);

        const corrections = [300, 700, 1500];
        corrections.forEach((delay) => {
          setTimeout(() => {
            virtualizer.scrollToIndex(targetIndex, { align: "start" });
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
      virtualizer.scrollToIndex(index, { align: "start" });
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
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
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
            if (clickX < halfWidth) {
              el.scrollBy({ top: -(containerHeight * pageTurnRatio), behavior: "smooth" });
            } else {
              el.scrollBy({ top: containerHeight * pageTurnRatio, behavior: "smooth" });
            }
          }}
          style={{
            height: containerHeight,
            overflowY: "auto",
            overflowX: "hidden",
            position: "relative",
            padding: "0px",
            boxSizing: "border-box",
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-y",
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
            font-family: Georgia, "Times New Roman", serif;
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
            color: ${annotationColor};
            font-size: 0.7em;
            font-family: "Microsoft YaHei", "微软雅黑", sans-serif;
          }

          @media (max-width: 768px) {
            .reading-wrapper {
              height: 100dvh !important;
            }
            /* 移动端 justify 易导致跨行拖选时选区被拉满；左对齐可减轻 WebKit 行为 */
            .reader-content {
              text-align: left;
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
