"use client";

import React, { useCallback, useRef, useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { ProcessedContent } from "@/hooks/useBookshelf";
import { useVirtualizer } from '@tanstack/react-virtual';

// Layout constants
const HEADER_HEIGHT = 56;
const MOBILE_HEADER_HEIGHT = 48;
const READING_PADDING_HORIZONTAL = 32;
const MOBILE_READING_PADDING_HORIZONTAL = 12;
const PARAGRAPH_GAP = 16;
const MOBILE_BREAKPOINT = 768;
const MOBILE_TOP_GAP = 5;
const MOBILE_BOTTOM_SAFE_ZONE = 60;

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

// Custom comparison function
function paragraphPropsAreEqual(
  prev: {
    paragraph: ProcessedContent[number];
    pIndex: number;
    onWordClick: (word: string, lemma: string, event: React.MouseEvent) => void;
    annotations?: Annotations;
    annotationColor?: string;
    searchQuery?: string;
    isCurrentSearchResult?: boolean;
    highlightBg?: string;
    isDarkMode?: boolean;
  },
  next: {
    paragraph: ProcessedContent[number];
    pIndex: number;
    onWordClick: (word: string, lemma: string, event: React.MouseEvent) => void;
    annotations?: Annotations;
    annotationColor?: string;
    searchQuery?: string;
    isCurrentSearchResult?: boolean;
    highlightBg?: string;
    isDarkMode?: boolean;
  }
) {
  if (prev.pIndex !== next.pIndex) return false;
  if (prev.onWordClick !== next.onWordClick) return false;
  if (prev.annotationColor !== next.annotationColor) return false;
  if (prev.searchQuery !== next.searchQuery) return false;
  if (prev.isCurrentSearchResult !== next.isCurrentSearchResult) return false;
  if (prev.highlightBg !== next.highlightBg) return false;
  if (prev.isDarkMode !== next.isDarkMode) return false;
  
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
  initialParagraphText?: string;  // 新增这一行


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
  initialParagraphText = "",  // 新增这一行


}: ReadingAreaProps, ref: React.Ref<ReadingAreaRef>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  const [readProgress, setReadProgress] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);

  const virtualizer = useVirtualizer({
    count: processedContent ? processedContent.length : 0,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 80,
    overscan: 20,
  });


  useEffect(() => {
    const calcHeight = () => {
      const mobile = window.innerWidth <= MOBILE_BREAKPOINT;
      const headerH = mobile ? MOBILE_HEADER_HEIGHT : HEADER_HEIGHT;
      const PAGER_HEIGHT = 50;
      const h = mobile
        ? window.innerHeight - headerH - MOBILE_TOP_GAP - MOBILE_BOTTOM_SAFE_ZONE - PAGER_HEIGHT
        : window.innerHeight - headerH - PAGER_HEIGHT;
      const PAGER_HEIGHT = 50;
      const h = mobile
        ? window.innerHeight - headerH - MOBILE_TOP_GAP - MOBILE_BOTTOM_SAFE_ZONE - PAGER_HEIGHT
        : window.innerHeight - headerH - PAGER_HEIGHT;
      const PAGER_HEIGHT = 50;
      const h = mobile
        ? window.innerHeight - headerH - MOBILE_TOP_GAP - MOBILE_BOTTOM_SAFE_ZONE - PAGER_HEIGHT
        : window.innerHeight - headerH - PAGER_HEIGHT;
      setContainerHeight(Math.max(h, 200));
    };
    calcHeight();
    window.addEventListener('resize', calcHeight);
    return () => window.removeEventListener('resize', calcHeight);
  }, []);

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
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* 阅读容器 - 滚动模式 */}
        <div 
          ref={containerRef}
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
                  />
                </div>
              );
            })}
          </div>

        </div>

        {/* 翻页按钮 */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 16px",
          borderTop: `1px solid ${isDarkMode ? "#333" : "#e8e8e8"}`,
          backgroundColor: isDarkMode ? "#1a1a2e" : "#f8f8f8",
          flexShrink: 0,
        }}>
          <button
            onClick={() => {
              const el = containerRef.current;
              if (el) el.scrollBy({ top: -(containerHeight * 0.85), behavior: "smooth" });
            }}
            style={{
              padding: "10px 24px",
              border: `1px solid ${isDarkMode ? "#444" : "#ddd"}`,
              borderRadius: "6px",
              backgroundColor: isDarkMode ? "#2a2a3e" : "#fff",
              color: isDarkMode ? "#ccc" : "#333",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            上一页
          </button>
          <span style={{ fontSize: "13px", color: isDarkMode ? "#888" : "#999" }}>
            {readProgress}%
          </span>
          <button
            onClick={() => {
              const el = containerRef.current;
              if (el) el.scrollBy({ top: containerHeight * 0.85, behavior: "smooth" });
            }}
            style={{
              padding: "10px 24px",
              border: `1px solid ${isDarkMode ? "#444" : "#ddd"}`,
              borderRadius: "6px",
              backgroundColor: isDarkMode ? "#2a2a3e" : "#fff",
              color: isDarkMode ? "#ccc" : "#333",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            下一页
          </button>
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
