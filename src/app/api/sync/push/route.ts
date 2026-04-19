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

// 书籍完整内容（不含 processedContent）
interface Book {
  id: string;
  title: string;
  author?: string;
  language?: string;
  paragraphs?: string[];
  totalParagraphs?: number;
  coverColor?: string;
  themeColor?: string;
  addedAt?: number;
  lastReadAt?: number;
  lastScrollPosition?: number;
  lastParagraphIndex?: number;
  annotations?: Record<string, VocabEntry>;
  sentenceAnnotations?: Array<{ id: string; [key: string]: unknown }>;
  bookmarks?: Array<{ id: string; [key: string]: unknown }>;
}

interface SyncData {
  vocabulary?: Record<string, VocabEntry>;
  bookProgress?: Record<string, BookProgress>;
  books?: Book[];
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
    if (process.env.NODE_ENV !== 'production') {
      console.error('[sync/push]', error);
    }
    return NextResponse.json({ error: 'Push failed' }, { status: 500 });
  }
}

// 智能合并策略：
// - 词汇表：取并集，相同词根保留 correctCount 较大的
// - 阅读进度：按 bookId 匹配，找不到则按 title 回退匹配
// - 标注（annotations）：取并集合并
// - 句子标注（sentenceAnnotations）：按 id 去重取并集
// - 书签（bookmarks）：按 id 去重取并集
// - 当同一本书在两端有不同 bookId 时（通过 title 匹配），合并后用两个 bookId 都存储
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

  // 2. 建立远端的 title → bookId 映射，用于 title 回退匹配
  const remoteTitleMap: Record<string, string> = {};
  if (remote.bookProgress) {
    for (const [bid, progress] of Object.entries(remote.bookProgress)) {
      if (progress.title) {
        remoteTitleMap[progress.title] = bid;
      }
    }
  }

  // 3. 合并阅读进度
  const mergedProgress: Record<string, BookProgress> = { ...(remote.bookProgress || {}) };
  // 记录哪些 bookId 是通过 title 匹配发现的，用于双份存储
  const titleMatchedPairs: Array<{ localId: string; remoteId: string; mergedData: BookProgress }> = [];

  for (const [localBookId, localProgress] of Object.entries(local.bookProgress || {})) {
    if (!mergedProgress[localBookId]) {
      // 本地有，远端没有，尝试按 title 查找
      if (localProgress.title && remoteTitleMap[localProgress.title]) {
        const remoteBookId = remoteTitleMap[localProgress.title];
        const remoteProgress = mergedProgress[remoteBookId];
        if (remoteProgress) {
          // 两者都有，按 title 匹配成功，合并数据
          const mergedData = mergeBookProgressData(remoteProgress, localProgress);
          mergedProgress[localBookId] = mergedData;
          titleMatchedPairs.push({ localId: localBookId, remoteId: remoteBookId, mergedData });
        }
      }
      // 如果找不到匹配的，直接添加
      if (!mergedProgress[localBookId]) {
        mergedProgress[localBookId] = localProgress;
      }
    } else {
      // bookId 相同，直接合并
      mergedProgress[localBookId] = mergeBookProgressData(mergedProgress[localBookId], localProgress);
    }
  }

  // 4. 对 title 匹配的对，用远端 bookId 也存一份（双份存储）
  // 这样设备 A pull 时用自己的 bookId 能找到，设备 B pull 时用自己的 bookId 也能找到
  for (const pair of titleMatchedPairs) {
    mergedProgress[pair.remoteId] = pair.mergedData;
  }

  // 5. 合并书籍完整内容
  const mergedBooks = mergeBooks(remote.books || [], local.books || []);

  return {
    vocabulary: mergedVocab,
    bookProgress: mergedProgress,
    books: mergedBooks,
  };
}

// 合并两本书的进度数据
function mergeBookProgressData(remote: BookProgress, local: BookProgress): BookProgress {
  // 阅读进度取较大值
  const useLocal = (local.lastScrollPosition || 0) > (remote.lastScrollPosition || 0);

  const merged: BookProgress = {
    ...remote,
    ...local,
    lastScrollPosition: useLocal ? local.lastScrollPosition : remote.lastScrollPosition,
    lastParagraphIndex: useLocal ? local.lastParagraphIndex : remote.lastParagraphIndex,
    lastReadAt: Math.max(local.lastReadAt || 0, remote.lastReadAt || 0),
  };

  // 标注取并集
  merged.annotations = {
    ...(remote.annotations || {}),
    ...(local.annotations || {}),
  };

  // 句子标注按 id 去重取并集
  const sentenceIds = new Set((remote.sentenceAnnotations || []).map(s => s.id));
  const newSentences = (local.sentenceAnnotations || []).filter(s => !sentenceIds.has(s.id));
  merged.sentenceAnnotations = [
    ...(remote.sentenceAnnotations || []),
    ...newSentences,
  ];

  // 书签按 id 去重取并集
  const bookmarkIds = new Set((remote.bookmarks || []).map(b => b.id));
  const newBookmarks = (local.bookmarks || []).filter(b => !bookmarkIds.has(b.id));
  merged.bookmarks = [
    ...(remote.bookmarks || []),
    ...newBookmarks,
  ];

  return merged;
}

// 合并书籍列表
// 策略：按 bookId 匹配，相同则合并；找不到按 title 回退匹配，合并后双份存储
// 合并时：基础字段（title, author 等）取一方（优先本地有内容的），标注/书签取并集
function mergeBooks(remoteBooks: Book[], localBooks: Book[]): Book[] {
  const result: Book[] = [];
  const usedLocal = new Set<string>();
  const usedRemote = new Set<string>();
  const titleMatched: Array<{ localBook: Book; remoteBook: Book; merged: Book }> = [];

  // 1. 按 bookId 精确匹配
  for (const localBook of localBooks) {
    const remoteBook = remoteBooks.find(b => b.id === localBook.id);
    if (remoteBook) {
      const merged = mergeTwoBooks(remoteBook, localBook);
      result.push(merged);
      usedLocal.add(localBook.id);
      usedRemote.add(remoteBook.id);
      titleMatched.push({ localBook, remoteBook, merged });
    } else {
      // 本地有但远端没有，保留
      result.push(localBook);
      usedLocal.add(localBook.id);
    }
  }

  // 2. 远端有但本地没有的，按 title 回退匹配
  for (const remoteBook of remoteBooks) {
    if (usedRemote.has(remoteBook.id)) continue;

    const localBook = localBooks.find(b => b.title === remoteBook.title && !usedLocal.has(b.id));
    if (localBook) {
      // 按 title 匹配成功，合并后双份存储
      const merged = mergeTwoBooks(remoteBook, localBook);
      // 用本地的 bookId 存一份
      result.push({ ...merged, id: localBook.id });
      usedLocal.add(localBook.id);
      // 用远端的 bookId 也存一份
      result.push({ ...merged, id: remoteBook.id });
      usedRemote.add(remoteBook.id);
    } else {
      // 远端有但本地没有，直接添加
      result.push(remoteBook);
      usedRemote.add(remoteBook.id);
    }
  }

  return result;
}

// 合并两本书的内容
function mergeTwoBooks(remote: Book, local: Book): Book {
  // 基础字段优先取本地（用户可能对 title 有修改）
  const merged: Book = {
    ...remote,
    ...local,
    // paragraphs 取较长的（内容更完整）
    paragraphs: (local.paragraphs?.length || 0) >= (remote.paragraphs?.length || 0)
      ? local.paragraphs
      : remote.paragraphs,
  };

  // 标注取并集
  merged.annotations = {
    ...(remote.annotations || {}),
    ...(local.annotations || {}),
  };

  // 句子标注按 id 去重取并集
  const sentenceIds = new Set((remote.sentenceAnnotations || []).map(s => s.id));
  const newSentences = (local.sentenceAnnotations || []).filter(s => !sentenceIds.has(s.id));
  merged.sentenceAnnotations = [
    ...(remote.sentenceAnnotations || []),
    ...newSentences,
  ];

  // 书签按 id 去重取并集
  const bookmarkIds = new Set((remote.bookmarks || []).map(b => b.id));
  const newBookmarks = (local.bookmarks || []).filter(b => !bookmarkIds.has(b.id));
  merged.bookmarks = [
    ...(remote.bookmarks || []),
    ...newBookmarks,
  ];

  // 阅读进度取较大值
  merged.lastScrollPosition = Math.max(local.lastScrollPosition || 0, remote.lastScrollPosition || 0);
  merged.lastParagraphIndex = Math.max(local.lastParagraphIndex || 0, remote.lastParagraphIndex || 0);
  merged.lastReadAt = Math.max(local.lastReadAt || 0, remote.lastReadAt || 0);

  return merged;
}
