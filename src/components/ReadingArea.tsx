"use client";

import React, {
  useCallback,
  useRef,
  useEffect,
  useLayoutEffect,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { ProcessedContent, SentenceAnnotation } from "@/hooks/useBookshelf";
import { useVirtualizer } from '@tanstack/react-virtual';

// Layout constants
const READING_PADDING_HORIZONTAL = 32;
const MOBILE_READING_PADDING_HORIZONTAL = 12;
const MOBILE_BREAKPOINT = 768;
const VIEWPORT_TRIM_EPS = 2;
/** 左下角进度条占位，与正文分栏排版，避免 fixed 遮挡主文 */
const READING_PROGRESS_FOOTER_PADDING_Y = 8;

/** 至少两个「词」才允许整句翻译（选单字/单词不弹出） */
const MIN_WORDS_FOR_SENTENCE_TRANSLATE = 2;

/** 统计选区内词数：优先 Intl.Segmenter（中英日等均按语言分词）；否则拉丁按空格，中日韩按字计词 */
function countWordsInSelection(text: string): number {
  const t = text.trim();
  if (!t) return 0;

  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    try {
      const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
      let n = 0;
      for (const seg of segmenter.segment(t)) {
        if (seg.isWordLike && seg.segment.trim().length > 0) {
          n++;
        }
      }
      return n;
    } catch {
      /* 继续走降级 */
    }
  }

  const cjkCount = (t.match(/[\u3000-\u303f\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/g) || []).length;
  const withoutCjk = t.replace(/[\u3000-\u303f\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]+/g, " ").trim();
  const latinWords = withoutCjk.length === 0 ? 0 : withoutCjk.split(/\s+/).filter(Boolean).length;
  return cjkCount + latinWords;
}

function selectionLongEnoughForSentenceTranslate(text: string): boolean {
  return countWordsInSelection(text) >= MIN_WORDS_FOR_SENTENCE_TRANSLATE;
}

function rectsCrossViewportTop(r: DOMRect, cRect: DOMRect): boolean {
  return r.bottom > cRect.top && r.top < cRect.top;
}

/** 底边切开一行：该行有一部分在视口内、有一部分在视口下 */
function rectsCrossViewportBottom(r: DOMRect, cRect: DOMRect): boolean {
  return r.bottom > cRect.bottom && r.top < cRect.bottom;
}

/** 主文行框（过滤词后释义等小碎片），视口坐标；扫描已挂载段落，不依赖 virtualizer.getVirtualItems()，避免边缘段漏测 */
function gatherMainTextLineRects(
  contentRoot: HTMLElement,
  scrollEl: HTMLElement,
  minMainLineHeight: number
): DOMRect[] {
  const cRect = scrollEl.getBoundingClientRect();
  const minWidth = 4;
  /** 略放宽，避免字号/缩放/DPR 下行高略小于估算导致整行被过滤 */
  const minH = Math.max(6, minMainLineHeight - 8);
  const out: DOMRect[] = [];

  const wraps = contentRoot.querySelectorAll("[data-index]");
  for (let w = 0; w < wraps.length; w++) {
    const wrap = wraps[w];
    if (!(wrap instanceof HTMLElement)) continue;
    const paragraph = wrap.querySelector(".paragraph");
    if (!paragraph) continue;

    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const list = range.getClientRects();
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (r.height < minH || r.width < minWidth) continue;
      if (r.bottom < cRect.top || r.top > cRect.bottom) continue;
      out.push(r);
    }
  }
  return out;
}

/** 顶边切开一行时，略减小 scrollTop，使该行从行首完整显示 */
function trimHalfLineAtTop(
  scrollEl: HTMLElement,
  contentRoot: HTMLElement,
  minMainLineHeight: number
): void {
  const cRect = scrollEl.getBoundingClientRect();
  const rects = gatherMainTextLineRects(contentRoot, scrollEl, minMainLineHeight);
  let minTop = Infinity;
  for (const r of rects) {
    if (!rectsCrossViewportTop(r, cRect)) continue;
    minTop = Math.min(minTop, r.top);
  }
  if (minTop === Infinity) return;
  const overlap = cRect.top - minTop;
  if (overlap <= VIEWPORT_TRIM_EPS) return;
  scrollEl.scrollTop = Math.max(0, scrollEl.scrollTop - overlap);
}

/**
 * 视口底部若有半截行：略减小 scrollTop，把该行整体移到视口下方（当前屏以完整行结束），
 * 该行会在下一页顶边对齐时出现——与「向下滚动凑齐最后一行」不同，不会破坏页顶整行。
 */
function trimHalfLineOffBottomForNextPage(
  scrollEl: HTMLElement,
  contentRoot: HTMLElement,
  minMainLineHeight: number
): void {
  const cRect = scrollEl.getBoundingClientRect();
  const rects = gatherMainTextLineRects(contentRoot, scrollEl, minMainLineHeight);
  let lineTopScreen = Infinity;
  for (const r of rects) {
    if (!rectsCrossViewportBottom(r, cRect)) continue;
    lineTopScreen = Math.min(lineTopScreen, r.top);
  }
  if (lineTopScreen === Infinity) return;
  const overlapHide = cRect.bottom - lineTopScreen;
  if (overlapHide <= VIEWPORT_TRIM_EPS) return;
  scrollEl.scrollTop = Math.max(0, scrollEl.scrollTop - overlapHide);
}

/**
 * 翻页后：先保证页顶整行；再把页底半截行裁掉（整行留给下一页）。
 * 两者交替直到稳定，避免先裁底又破坏顶或反之。
 */
function trimAfterPageTurnPreferTop(
  scrollEl: HTMLElement,
  contentRoot: HTMLElement,
  minMainLineHeight: number
): void {
  for (let i = 0; i < 10; i++) {
    const before = scrollEl.scrollTop;
    trimHalfLineAtTop(scrollEl, contentRoot, minMainLineHeight);
    trimHalfLineOffBottomForNextPage(scrollEl, contentRoot, minMainLineHeight);
    if (Math.abs(scrollEl.scrollTop - before) < 0.5) break;
  }
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
  onTextSelect,
  sentenceAnnotations = [],
  onRemoveSentenceAnnotation,
  clickToTurnPage = false,

}: ReadingAreaProps, ref: React.Ref<ReadingAreaRef>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const selectionStartRef = useRef<{ paragraphIndex: number; charIndex: number } | null>(null);
  /** 在阅读区内 pointerdown 时的 scrollTop，用于与 pointerup 对比，区分滚动与文本选择 */
  const pointerDownScrollTopRef = useRef(0);
  /** 安卓滑动模式：音量键交给浏览器/WebView 原生滚动后，仅做一次 trim（避免与 scrollReadingPage 双重滚动） */
  const pendingAndroidVolumeTrimRef = useRef(false);
  const volumeTrimFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volumeTrimScrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [readProgress, setReadProgress] = useState(0);
  const lastSwipeTimeRef = useRef(0);
  const lastProgrammaticPageTurnAt = useRef(0);

  const virtualizer = useVirtualizer({
    count: processedContent ? processedContent.length : 0,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 80,
    /** 上滑时多预渲染几段，减少量高变化时视口跳变 */
    overscan: 32,
  });

  /**
   * 整页翻动：先按可视高度 ± 一页（auto），再 trim 顶边整行 + 底边半截移出（裁底不留半行，留给下一页）。
   */
  const scrollReadingPage = useCallback(
    (direction: "next" | "prev") => {
      const el = containerRef.current;
      if (!el) return;

      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      if (now - lastProgrammaticPageTurnAt.current < 220) return;
      lastProgrammaticPageTurnAt.current = now;

      const pageH = el.clientHeight;
      if (pageH <= 0) return;

      const maxS = Math.max(0, el.scrollHeight - pageH);
      const S = el.scrollTop;

      if (direction === "next") {
        el.scrollTo({ top: Math.min(S + pageH, maxS), behavior: "auto" });
      } else {
        el.scrollTo({ top: Math.max(S - pageH, 0), behavior: "auto" });
      }

      const minMain = Math.max(12, Math.round(fontSize * Math.min(lineHeight, 3) * 0.58));
      const runTrim = () => {
        const scrollEl = containerRef.current;
        const root = contentRef.current;
        if (!scrollEl || !root || !processedContent?.length) return;
        trimAfterPageTurnPreferTop(scrollEl, root, minMain);
      };
      // 多等一帧：虚拟列表测量/挂载与 scroll 对齐后再量行框，减少漏检
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(runTrim);
        });
      });
    },
    [fontSize, lineHeight, processedContent, virtualizer]
  );

  /** 仅整行对齐（与 scrollReadingPage 末尾 trim 一致），供安卓滑动模式音量键原生滚动后调用 */
  const runTrimAfterVolumeNativeScroll = useCallback(() => {
    const scrollEl = containerRef.current;
    const root = contentRef.current;
    if (!scrollEl || !root || !processedContent?.length) return;
    const minMain = Math.max(12, Math.round(fontSize * Math.min(lineHeight, 3) * 0.58));
    const runTrim = () => {
      const el = containerRef.current;
      const r = contentRef.current;
      if (!el || !r) return;
      trimAfterPageTurnPreferTop(el, r, minMain);
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(runTrim);
      });
    });
  }, [fontSize, lineHeight, processedContent]);

  const isAndroidSwipeScrollMode =
    typeof navigator !== "undefined" &&
    /Android/i.test(navigator.userAgent) &&
    !clickToTurnPage;

  // 安卓 + 滑动模式：原生滚动结束后 debounce trim（仅当本轮为音量键触发）
  useLayoutEffect(() => {
    if (!isAndroidSwipeScrollMode) return;
    const el = containerRef.current;
    if (!el) return;

    const clearFallback = () => {
      if (volumeTrimFallbackTimerRef.current !== null) {
        clearTimeout(volumeTrimFallbackTimerRef.current);
        volumeTrimFallbackTimerRef.current = null;
      }
    };

    const flushTrim = () => {
      if (!pendingAndroidVolumeTrimRef.current) return;
      clearFallback();
      runTrimAfterVolumeNativeScroll();
      pendingAndroidVolumeTrimRef.current = false;
    };

    const onScroll = () => {
      if (!pendingAndroidVolumeTrimRef.current) return;
      if (volumeTrimScrollDebounceRef.current !== null) {
        clearTimeout(volumeTrimScrollDebounceRef.current);
      }
      volumeTrimScrollDebounceRef.current = setTimeout(() => {
        volumeTrimScrollDebounceRef.current = null;
        flushTrim();
      }, 120);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (volumeTrimScrollDebounceRef.current !== null) {
        clearTimeout(volumeTrimScrollDebounceRef.current);
        volumeTrimScrollDebounceRef.current = null;
      }
      clearFallback();
    };
  }, [
    isAndroidSwipeScrollMode,
    runTrimAfterVolumeNativeScroll,
    processedContent?.length,
  ]);

  // 音量键翻页
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isVolUp = e.key === "AudioVolumeUp" || e.key === "VolumeUp";
      const isVolDown = e.key === "AudioVolumeDown" || e.key === "VolumeDown";
      if (!isVolUp && !isVolDown) return;

      /**
       * 桌面 / iOS / 安卓点击翻页：捕获阶段拦截，由 scrollReadingPage 单次翻页 + trim。
       * 安卓 + 滑动模式（如 VIA「音量键翻页」）：WebView 往往在 native 层已滚一屏，
       * 若再调用 scrollReadingPage 会双重滚动；此处不 preventDefault、不二次 scroll，只标记
       * 事后 trim（见 pendingAndroidVolumeTrimRef + scroll 监听）。
       */
      if (isAndroidSwipeScrollMode) {
        e.stopPropagation();
        const now =
          typeof performance !== "undefined" ? performance.now() : Date.now();
        if (now - lastProgrammaticPageTurnAt.current < 220) return;
        lastProgrammaticPageTurnAt.current = now;

        pendingAndroidVolumeTrimRef.current = true;
        if (volumeTrimFallbackTimerRef.current !== null) {
          clearTimeout(volumeTrimFallbackTimerRef.current);
        }
        volumeTrimFallbackTimerRef.current = setTimeout(() => {
          volumeTrimFallbackTimerRef.current = null;
          if (!pendingAndroidVolumeTrimRef.current) return;
          runTrimAfterVolumeNativeScroll();
          pendingAndroidVolumeTrimRef.current = false;
        }, 400);
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      scrollReadingPage(isVolUp ? "prev" : "next");
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [
    scrollReadingPage,
    isAndroidSwipeScrollMode,
    runTrimAfterVolumeNativeScroll,
    clickToTurnPage,
  ]);

  // 文本选择功能 - 句子翻译
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return;

    const selectedText = selection.toString().trim();
    if (!selectionLongEnoughForSentenceTranslate(selectedText)) return;
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
   * 句子翻译：仅在「交互结束」后再读选区并回调父组件。
   * 若在 document 上跟随 selectionchange 同步 setState，拖选较长时 React
   * 重绘 / 虚拟列表会替换原文 DOM，浏览器会把选区归一化到整段，表现为后文被全选。
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const SCROLL_SKIP_PX = 14;
    const FINALIZE_MS = 64;

    /** 本次 pointer 序列是否从阅读区内按下；仅此时用 scrollTop 区分「滚动」与「选文」 */
    const pointerDownInContainerRef = { current: false };
    let finalizeTimer: number | null = null;
    let keyFinalizeTimer: number | null = null;

    const trySyncSelection = () => {
      const el = containerRef.current;
      if (!el) return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      const anchor = sel.anchorNode;
      const focus = sel.focusNode;
      if (!anchor || !focus) return;
      if (!el.contains(anchor) || !el.contains(focus)) return;
      handleTextSelection();
    };

    const scheduleFinalizeSelection = () => {
      if (finalizeTimer !== null) {
        clearTimeout(finalizeTimer);
      }
      finalizeTimer = window.setTimeout(() => {
        finalizeTimer = null;
        const el = containerRef.current;
        if (!el) return;
        if (pointerDownInContainerRef.current) {
          if (Math.abs(el.scrollTop - pointerDownScrollTopRef.current) > SCROLL_SKIP_PX) {
            return;
          }
        }
        trySyncSelection();
      }, FINALIZE_MS);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      const el = containerRef.current;
      if (!el) return;
      pointerDownInContainerRef.current = el.contains(e.target as Node);
      if (pointerDownInContainerRef.current) {
        pointerDownScrollTopRef.current = el.scrollTop;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      scheduleFinalizeSelection();
    };

    /** 键盘扩选（Shift+方向键）无 pointer，用 keyup 兜底 */
    const onKeyUp = (e: KeyboardEvent) => {
      if (
        e.key !== "ArrowLeft" &&
        e.key !== "ArrowRight" &&
        e.key !== "ArrowUp" &&
        e.key !== "ArrowDown"
      ) {
        return;
      }
      if (keyFinalizeTimer !== null) {
        clearTimeout(keyFinalizeTimer);
      }
      keyFinalizeTimer = window.setTimeout(() => {
        keyFinalizeTimer = null;
        trySyncSelection();
      }, 120);
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("keyup", onKeyUp, true);

    return () => {
      if (finalizeTimer !== null) clearTimeout(finalizeTimer);
      if (keyFinalizeTimer !== null) clearTimeout(keyFinalizeTimer);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("keyup", onKeyUp, true);
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



  // 监听滚动，更新进度（节流父组件回调与进度 state，减轻上滑时丢帧、乱跳）
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let ticking = false;
    let lastHeavyEmit = 0;
    let lastProgressUi = 0;
    const HEAVY_MS = 110;

    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const percent = getScrollPercent();
          const now = Date.now();
          if (now - lastProgressUi >= HEAVY_MS) {
            lastProgressUi = now;
            setReadProgress(percent);
          }
          if (now - lastHeavyEmit >= HEAVY_MS) {
            lastHeavyEmit = now;
            if (onProgressChange) {
              onProgressChange(percent);
            }
            if (onParagraphIndexChange) {
              onParagraphIndexChange(getFirstVisibleIndex());
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    };


    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [getScrollPercent, onProgressChange, onParagraphIndexChange, getFirstVisibleIndex]);

  /**
   * 滑动模式下的左右滑翻页；点击翻页模式下不注册（避免误判纵向为横向、preventDefault 卡住滚动）。
   * 轴向判定偏纵向：拇指上滑常有斜向分量，误判为横向会阻断原生滚动导致卡顿、抖动。
   */
  useEffect(() => {
    if (clickToTurnPage) return;

    const el = containerRef.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let direction: 'none' | 'horizontal' | 'vertical' = 'none';

    const AXIS_THRESHOLD = 12;
    /** 纵向位移需明显大于横向才视为上下浏览（放宽误触横向） */
    const VERTICAL_DOMINANCE = 2.35;
    /** 判定为横向翻页需横向明显大于纵向 */
    const HORIZONTAL_DOMINANCE = 1.42;
    /** 只有横向位移足够大才 preventDefault，避免轻微斜滑锁死滚动 */
    const PREVENT_DEFAULT_MIN_AX = 30;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = Date.now();
      direction = 'none';
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (direction === 'vertical') return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      const ax = Math.abs(deltaX);
      const ay = Math.abs(deltaY);

      if (direction === 'none' && (ax > AXIS_THRESHOLD || ay > AXIS_THRESHOLD)) {
        if (ay > ax * VERTICAL_DOMINANCE) {
          direction = 'vertical';
          return;
        }
        if (ax > ay * HORIZONTAL_DOMINANCE) {
          direction = 'horizontal';
        } else {
          direction = 'vertical';
        }
      }

      if (
        direction === 'horizontal' &&
        ax > PREVENT_DEFAULT_MIN_AX &&
        ax > ay
      ) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (direction !== 'horizontal') return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - startX;
      const deltaTime = Date.now() - startTime;

      if (Math.abs(deltaX) > 50 && deltaTime < 800) {
        if (deltaX < 0) {
          scrollReadingPage("next");
        } else {
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
  }, [scrollReadingPage, clickToTurnPage]);

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
  }));



  if (processedContent && processedContent.length > 0) {
    const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
    const currentHorizPadding = isMobile ? MOBILE_READING_PADDING_HORIZONTAL : READING_PADDING_HORIZONTAL;

    return (
      <div 
        className="reading-wrapper" 
        style={{ 
          backgroundColor,
          flex: 1,
          minHeight: 0,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* 阅读容器 - 唯一纵向滚动层；高度随父级 flex 分配，与 clientHeight 一致 */}
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
            if (clickX < halfWidth) {
              scrollReadingPage("prev");
            } else {
              scrollReadingPage("next");
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

        {/* 左下角阅读进度（排在正文下方，不占正文滚动层，避免遮挡） */}
        <div
          style={{
            flexShrink: 0,
            paddingLeft: 16,
            paddingRight: 16,
            paddingTop: READING_PROGRESS_FOOTER_PADDING_Y,
            paddingBottom: 12,
            pointerEvents: "none",
          }}
        >
          <span
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
          </span>
        </div>

        <style jsx>{`
          .reading-wrapper {
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
