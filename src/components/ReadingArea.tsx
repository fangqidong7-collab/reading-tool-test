"use client";

import React from "react";
import { ProcessedContent } from "@/hooks/useBookshelf";

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
  const handleClick = (word: string, event: React.MouseEvent) => {
    if (isClickable(word)) {
      onWordClick(word, event);
    }
  };

  // If we have processed content, use it for rendering
  if (processedContent && processedContent.length > 0) {
    return (
      <div className="reading-area">
        <div className="text-content">
          {processedContent.map((paragraph, pIndex) => (
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
                
                return (
                  <span
                    key={key}
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
            </p>
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
            margin-bottom: 1.5em;
          }
          
          .paragraph:last-child {
            margin-bottom: 0;
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
            white-space: nowrap;
            pointer-events: none;
          }
          
          .word-rt {
            display: block;
            font-size: 50%;
            color: #e74c3c;
            font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
            line-height: 1.2;
            text-align: center;
            background: rgba(255, 255, 255, 0.95);
            padding: 2px 6px;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          }
          
          .word-text {
            position: relative;
          }
        `}</style>
      </div>
    );
  }

  // Fallback: render plain text (should not happen in normal use)
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
