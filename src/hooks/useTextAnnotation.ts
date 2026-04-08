"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { lemmatize, getWordMeaning, findWordFamily } from "@/lib/dictionary";
import { translateWord } from "@/lib/translate";

export interface AnnotatedWord {
  root: string;
  meaning: string;
  pos: string;
  count: number;
}

export interface TextAnnotation {
  text: string;
  annotations: Record<string, AnnotatedWord>;
}

const STORAGE_KEY = "english-reader-data";

// 示例英文文本
const SAMPLE_TEXT = `The Art of Learning

Every day presents us with countless opportunities to learn something new. Whether we realize it or not, learning is an essential part of human existence. From the moment we are born, we begin a journey of discovery that continues throughout our lives.

Children are natural learners. They ask questions about everything they see and touch. They experiment with objects, trying to understand how the world works. When they drop a toy, they watch it fall. When they speak, they observe the reactions they receive. This natural curiosity drives them to explore and grow.

As we grow older, however, many of us lose this innate desire to learn. We become comfortable with what we know and resist new ideas. We forget that every person we meet, every experience we have, and every challenge we face has something to teach us.

The truth is that learning never stops. Even when we think we know everything about a subject, there is always more to discover. Scientists spend entire careers studying a single topic and still find new mysteries to explore. Artists dedicate their lives to their craft and continue to develop new techniques and styles.

One of the most important skills we can develop is the ability to learn how to learn. This means understanding our own minds and how we process information. Some people learn best by reading, while others prefer hands-on experience. Some need silence to concentrate, while others work better with background noise.

When we discover our own learning style, we can approach new knowledge more effectively. We can create study habits and environments that help us absorb information more easily. We can be patient with ourselves when we struggle, understanding that mastery takes time.

The benefits of continuous learning extend far beyond simply acquiring new skills. Learning keeps our minds sharp and helps protect against cognitive decline. It opens doors to new opportunities and expands our understanding of the world around us.

Most importantly, learning brings joy and meaning to our lives. There is a special satisfaction in mastering a new subject or understanding a complex idea. The process of learning connects us with others who share our interests and passions.

So whether you are a student in a classroom or an adult pursuing a hobby, remember that learning is a gift you give yourself. Embrace every opportunity to grow, and you will discover a richer, more fulfilling life.`;

export function useTextAnnotation() {
  const [text, setText] = useState<string>("");
  const [annotations, setAnnotations] = useState<Record<string, AnnotatedWord>>({});
  const [selectedWord, setSelectedWord] = useState<{
    word: string;
    position: { x: number; y: number };
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 从localStorage加载数据
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const data: TextAnnotation = JSON.parse(saved);
          setText(data.text);
          setAnnotations(data.annotations);
        } catch {
          // 如果解析失败，使用示例文本
          setText(SAMPLE_TEXT);
        }
      } else {
        // 首次加载，显示示例文本
        setText(SAMPLE_TEXT);
      }
    }
  }, []);
  
  // 保存到localStorage
  useEffect(() => {
    if (text && typeof window !== "undefined") {
      const data: TextAnnotation = { text, annotations };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }, [text, annotations]);
  
  // 处理单词点击
  const handleWordClick = useCallback(
    async (word: string, event: React.MouseEvent) => {
      const cleanWord = word.toLowerCase().trim();
      if (!cleanWord) return;
      
      // 设置选中的单词位置
      const rect = (event.target as HTMLElement).getBoundingClientRect();
      setSelectedWord({
        word: cleanWord,
        position: {
          x: rect.left + rect.width / 2,
          y: rect.top - 10,
        },
      });
    },
    []
  );
  
  // 标注全文
  const annotateAll = useCallback(async (word: string) => {
    const cleanWord = word.toLowerCase().trim();
    const root = lemmatize(cleanWord);
    
    if (annotations[root]) {
      return; // 已标注
    }
    
    setLoading(true);
    
    try {
      // 先查内置词典
      const entry = getWordMeaning(root);
      let meaning = entry?.meaning || "";
      let pos = entry?.pos || "";
      
      // 如果词典没有，使用AI翻译
      if (!meaning) {
        meaning = await translateWord(root);
        pos = "v."; // 默认词性
      }
      
      // 查找所有同词根的单词
      const family = findWordFamily(root, text);
      
      setAnnotations((prev) => ({
        ...prev,
        [root]: {
          root,
          meaning,
          pos,
          count: family.length,
        },
      }));
    } catch (err) {
      console.error("Annotation error:", err);
    } finally {
      setLoading(false);
      setSelectedWord(null);
    }
  }, [annotations, text]);
  
  // 取消标注
  const removeAnnotation = useCallback((word: string) => {
    const root = lemmatize(word.toLowerCase());
    setAnnotations((prev) => {
      const next = { ...prev };
      delete next[root];
      return next;
    });
    setSelectedWord(null);
  }, []);
  
  // 清除所有标注
  const clearAllAnnotations = useCallback(() => {
    setAnnotations({});
  }, []);
  
  // 上传文件
  const handleFileUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setText(content);
      setAnnotations({});
    };
    reader.readAsText(file, "UTF-8");
  }, []);
  
  // 设置文本
  const setCustomText = useCallback((newText: string) => {
    setText(newText);
    setAnnotations({});
  }, []);
  
  // 关闭tooltip
  const closeTooltip = useCallback(() => {
    setSelectedWord(null);
  }, []);
  
  // 跳转到单词位置
  const scrollToWord = useCallback(
    (word: string) => {
      const root = lemmatize(word.toLowerCase());
      const elements = containerRef.current?.querySelectorAll(
        `[data-root="${root}"]`
      );
      if (elements && elements.length > 0) {
        (elements[0] as HTMLElement).scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    },
    []
  );
  
  // 获取当前单词的标注信息
  const getWordAnnotation = useCallback(
    (word: string) => {
      const root = lemmatize(word.toLowerCase());
      return annotations[root] || null;
    },
    [annotations]
  );
  
  // 检查单词是否可点击（非标点符号）
  const isClickable = useCallback((word: string) => {
    return /^[a-zA-Z]+$/.test(word);
  }, []);
  
  return {
    text,
    annotations,
    selectedWord,
    loading,
    sidebarOpen,
    containerRef,
    handleWordClick,
    annotateAll,
    removeAnnotation,
    clearAllAnnotations,
    handleFileUpload,
    setCustomText,
    closeTooltip,
    scrollToWord,
    getWordAnnotation,
    isClickable,
    setSidebarOpen,
  };
}
