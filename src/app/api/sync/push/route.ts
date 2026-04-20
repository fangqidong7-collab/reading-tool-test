import { NextResponse } from 'next/server';
import { kv } from '@/lib/kv';
import { canonicalBookId, normalizeBookTitle } from '@/lib/syncMerge';
import { parseJsonBodyWithOptionalGzip } from '@/lib/syncServerBody';

/** 大包合并 + 写 KV 耗时较长；部署在 Vercel 等平台时可拉长单次允许执行时间 */
export const maxDuration = 120;

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
  /** 客户端上传的正文 */
  content?: string;
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
    const parsed = (await parseJsonBodyWithOptionalGzip(request)) as {
      syncCode?: string;
      data?: SyncData;
    };
    const { syncCode, data } = parsed;

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

    const updatedAt = Date.now();
    const stored = { ...merged, updatedAt };
    await kv.set(key, JSON.stringify(stored), { ex: 90 * 24 * 60 * 60 });

    // 一次往返返回合并结果，客户端无需再 pull（减一半请求，降低超时概率）
    return NextResponse.json({
      success: true,
      updatedAt,
      data: stored,
    });
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
// - 当同一本书在两端有不同 bookId 时（通过 title 匹配），进度仍写入双方 id 便于客户端按 id 查找；书籍列表只保留一条合并记录（canonical id）
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

  // 2. 建立远端规范化书名 → bookId 映射，用于 title 回退匹配
  const remoteTitleMap: Record<string, string> = {};
  if (remote.bookProgress) {
    for (const [bid, progress] of Object.entries(remote.bookProgress)) {
      if (progress.title) {
        remoteTitleMap[normalizeBookTitle(progress.title)] = bid;
      }
    }
  }

  // 3. 合并阅读进度
  const mergedProgress: Record<string, BookProgress> = { ...(remote.bookProgress || {}) };
  // 记录哪些 bookId 是通过 title 匹配发现的，用于双份存储进度（书籍列表已不再双份）
  const titleMatchedPairs: Array<{ localId: string; remoteId: string; mergedData: BookProgress }> = [];

  for (const [localBookId, localProgress] of Object.entries(local.bookProgress || {})) {
    if (!mergedProgress[localBookId]) {
      // 本地有，远端没有，尝试按 title 查找
      const nt = localProgress.title ? normalizeBookTitle(localProgress.title) : '';
      if (nt && remoteTitleMap[nt]) {
        const remoteBookId = remoteTitleMap[nt];
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

  // 4. title 匹配的进度：双方 bookId + canonical id 均指向同一份合并结果，便于各设备用本地 id 命中
  for (const pair of titleMatchedPairs) {
    mergedProgress[pair.remoteId] = pair.mergedData;
    mergedProgress[pair.localId] = pair.mergedData;
    const cid = canonicalBookId(pair.localId, pair.remoteId);
    mergedProgress[cid] = pair.mergedData;
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
// 策略：先 id 精确合并；再同书名不同 id 合并为一条（canonical id），避免书架出现两本相同书
function mergeBooks(remoteBooks: Book[], localBooks: Book[]): Book[] {
  const result: Book[] = [];
  const usedLocal = new Set<string>();
  const usedRemote = new Set<string>();

  // 1. bookId 完全一致
  for (const localBook of localBooks) {
    const remoteBook = remoteBooks.find((b) => b.id === localBook.id);
    if (remoteBook) {
      result.push(mergeTwoBooks(remoteBook, localBook));
      usedLocal.add(localBook.id);
      usedRemote.add(remoteBook.id);
    }
  }

  // 2. 书名相同但 id 不同（两台设备各生成过 uuid）
  for (const remoteBook of remoteBooks) {
    if (usedRemote.has(remoteBook.id)) continue;
    const localBook = localBooks.find(
      (b) =>
        !usedLocal.has(b.id) &&
        normalizeBookTitle(b.title) === normalizeBookTitle(remoteBook.title)
    );
    if (localBook) {
      const merged = mergeTwoBooks(remoteBook, localBook);
      const cid = canonicalBookId(remoteBook.id, localBook.id);
      result.push({ ...merged, id: cid });
      usedLocal.add(localBook.id);
      usedRemote.add(remoteBook.id);
    }
  }

  // 3. 仅存在于本地的书
  for (const localBook of localBooks) {
    if (!usedLocal.has(localBook.id)) {
      result.push(localBook);
      usedLocal.add(localBook.id);
    }
  }

  // 4. 仅存在于远端的书
  for (const remoteBook of remoteBooks) {
    if (!usedRemote.has(remoteBook.id)) {
      result.push(remoteBook);
      usedRemote.add(remoteBook.id);
    }
  }

  return result;
}

// 合并两本书的内容
function mergeTwoBooks(remote: Book, local: Book): Book {
  const lc = local.content ?? "";
  const rc = remote.content ?? "";
  /** 增量同步可能省略 content：空的一侧沿用另一侧正文 */
  let mergedContent: string;
  if (!lc) mergedContent = rc;
  else if (!rc) mergedContent = lc;
  else mergedContent = lc.length >= rc.length ? lc : rc;
  // 基础字段优先取本地（用户可能对 title 有修改）
  const merged: Book = {
    ...remote,
    ...local,
    content: mergedContent,
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
