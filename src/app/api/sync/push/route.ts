import { NextResponse } from 'next/server';
import { kv } from '@/lib/kv';

// 同步数据结构
interface VocabEntry {
  root: string;
  meaning: string;
  pos: string;
  correctCount: number;
}

interface BookProgress {
  title?: string;
  lastScrollPosition: number;
  lastParagraphIndex: number;
  lastReadAt: number;
  annotations?: Record<string, VocabEntry>;
  sentenceAnnotations?: Array<{ id: string; [key: string]: unknown }>;
  bookmarks?: Array<{ id: string; [key: string]: unknown }>;
}

interface SyncData {
  vocabulary?: Record<string, VocabEntry>;
  bookProgress?: Record<string, BookProgress>;
}

export async function POST(request: Request) {
  try {
    const { syncCode, data } = await request.json();

    if (!syncCode || !data) {
      return NextResponse.json({ error: 'syncCode and data required' }, { status: 400 });
    }

    const key = `sync:${syncCode.toUpperCase()}`;
    const existing = await kv.get(key);

    if (!existing) {
      return NextResponse.json({ error: 'Invalid sync code' }, { status: 404 });
    }

    // 合并策略：智能合并词汇表和书籍进度
    const existingData: SyncData = JSON.parse(existing as string);
    const merged = mergeData(existingData, data);

    await kv.set(key, JSON.stringify({
      ...merged,
      updatedAt: Date.now(),
    }), { ex: 90 * 24 * 60 * 60 });

    return NextResponse.json({ success: true, updatedAt: Date.now() });
  } catch (error) {
    console.error('Push sync error:', error);
    return NextResponse.json({ error: 'Push failed' }, { status: 500 });
  }
}

// 智能合并策略：
// - 词汇表：取并集，相同词根保留 correctCount 较大的
// - 阅读进度：相同 bookId 取 lastScrollPosition 较大的
// - 标注（annotations）：取并集合并
// - 句子标注（sentenceAnnotations）：按 id 去重取并集
// - 书签（bookmarks）：按 id 去重取并集
function mergeData(remote: SyncData, local: SyncData): SyncData {
  // 1. 合并词汇表（并集，保留 correctCount 较大的）
  const mergedVocab: Record<string, VocabEntry> = { ...(remote.vocabulary || {}) };
  for (const [key, value] of Object.entries(local.vocabulary || {})) {
    if (!mergedVocab[key]) {
      mergedVocab[key] = value;
    } else {
      // 保留 correctCount 较大的
      if ((value.correctCount || 0) > (mergedVocab[key].correctCount || 0)) {
        mergedVocab[key] = value;
      }
    }
  }

  // 2. 合并阅读进度
  const mergedProgress: Record<string, BookProgress> = { ...(remote.bookProgress || {}) };
  
  for (const [bookId, localProgress] of Object.entries(local.bookProgress || {})) {
    if (!mergedProgress[bookId]) {
      // 本地有，远端没有，直接使用
      mergedProgress[bookId] = localProgress;
    } else {
      // 两者都有，需要智能合并
      const remoteProgress = mergedProgress[bookId];
      
      // 阅读进度取较大值
      if ((localProgress.lastScrollPosition || 0) > (remoteProgress.lastScrollPosition || 0)) {
        mergedProgress[bookId] = {
          ...remoteProgress,
          ...localProgress,
          lastScrollPosition: localProgress.lastScrollPosition,
          lastParagraphIndex: localProgress.lastParagraphIndex,
          lastReadAt: Math.max(localProgress.lastReadAt || 0, remoteProgress.lastReadAt || 0),
        };
      } else {
        mergedProgress[bookId] = {
          ...mergedProgress[bookId],
          lastReadAt: Math.max(localProgress.lastReadAt || 0, remoteProgress.lastReadAt || 0),
        };
      }

      // 标注取并集
      if (localProgress.annotations) {
        mergedProgress[bookId].annotations = {
          ...(mergedProgress[bookId].annotations || {}),
          ...localProgress.annotations,
        };
      }

      // 句子标注按 id 去重取并集
      if (localProgress.sentenceAnnotations && localProgress.sentenceAnnotations.length > 0) {
        const existingIds = new Set((mergedProgress[bookId].sentenceAnnotations || []).map(s => s.id));
        const newAnnotations = localProgress.sentenceAnnotations.filter(s => !existingIds.has(s.id));
        mergedProgress[bookId].sentenceAnnotations = [
          ...(mergedProgress[bookId].sentenceAnnotations || []),
          ...newAnnotations,
        ];
      }

      // 书签按 id 去重取并集
      if (localProgress.bookmarks && localProgress.bookmarks.length > 0) {
        const existingIds = new Set((mergedProgress[bookId].bookmarks || []).map(b => b.id));
        const newBookmarks = localProgress.bookmarks.filter(b => !existingIds.has(b.id));
        mergedProgress[bookId].bookmarks = [
          ...(mergedProgress[bookId].bookmarks || []),
          ...newBookmarks,
        ];
      }
    }
  }

  return {
    vocabulary: mergedVocab,
    bookProgress: mergedProgress,
  };
}
