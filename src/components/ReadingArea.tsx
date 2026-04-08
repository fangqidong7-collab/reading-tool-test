"use client";

import React, { useMemo } from "react";
import { lemmatize } from "@/lib/dictionary";

interface ReadingAreaProps {
  text: string;
  annotations: Record<string, { root: string; meaning: string; pos: string; count: number }>;
  onWordClick: (word: string, event: React.MouseEvent) => void;
  getWordAnnotation: (word: string) => { root: string; meaning: string; pos: string; count: number } | null;
  isClickable: (word: string) => boolean;
}

// 解析文本为片段数组
function parseTextToSegments(text: string): Array<{
  type: "word" | "punctuation" | "whitespace";
  content: string;
}> {
  const segments: Array<{
    type: "word" | "punctuation" | "whitespace";
    content: string;
  }> = [];
  
  const regex = /([a-zA-Z]+|[^a-zA-Z\s]+|\s+)/g;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    const token = match[0];
    if (/^\s+$/.test(token)) {
      segments.push({ type: "whitespace", content: token });
    } else if (/^[a-zA-Z]+$/.test(token)) {
      segments.push({ type: "word", content: token });
    } else {
      segments.push({ type: "punctuation", content: token });
    }
  }
  
  return segments;
}

export function ReadingArea({
  text,
  onWordClick,
  getWordAnnotation,
  isClickable,
}: ReadingAreaProps) {
  const segments = useMemo(() => parseTextToSegments(text), [text]);
  
  const handleClick = (word: string, event: React.MouseEvent) => {
    if (isClickable(word)) {
      onWordClick(word, event);
    }
  };
  
  return (
    <div className="reading-area">
      <div className="text-content">
        {segments.map((segment, index) => {
          if (segment.type === "whitespace") {
            return (
              <span key={index} className="whitespace">
                {segment.content}
              </span>
            );
          }
          
          if (segment.type === "punctuation") {
            return (
              <span key={index} className="punctuation">
                {segment.content}
              </span>
            );
          }
          
          const word = segment.content;
          const root = lemmatize(word.toLowerCase());
          const annotation = getWordAnnotation(word);
          const isAnnotated = !!annotation;
          
          return (
            <span
              key={index}
              className={`word ${isClickable(word) ? "clickable" : ""} ${
                isAnnotated ? "annotated" : ""
              }`}
              data-root={root}
              onClick={(e) => handleClick(word, e)}
            >
              {isAnnotated && (
                <ruby className="word-ruby">
                  <rt className="word-rt">{annotation.meaning}</rt>
                </ruby>
              )}
              <span className="word-text">{word}</span>
            </span>
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
          line-height: 1.8;
          color: #333;
          text-align: justify;
        }
        
        .whitespace {
          white-space: pre-wrap;
        }
        
        .punctuation {
          color: #666;
        }
        
        .word {
          position: relative;
          display: inline;
          cursor: default;
        }
        
        .word.clickable {
          cursor: pointer;
          transition: background-color 0.15s ease;
          border-radius: 2px;
          padding: 1px 0;
        }
        
        .word.clickable:hover {
          background-color: rgba(74, 144, 217, 0.15);
        }
        
        .word.annotated {
          background-color: #fff3cd;
          padding: 1px 2px;
          border-radius: 2px;
        }
        
        .word.annotated:hover {
          background-color: #ffe69c;
        }
        
        .word-ruby {
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column-reverse;
          align-items: center;
          pointer-events: none;
          z-index: 10;
          margin-bottom: 2px;
        }
        
        .word-text {
          font-size: 18px;
          color: inherit;
        }
        
        .word-rt {
          font-size: 9px;
          color: #e74c3c;
          font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
          white-space: nowrap;
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.2;
          text-align: center;
        }
      `}</style>
    </div>
  );
}
