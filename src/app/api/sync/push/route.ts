import { NextResponse } from 'next/server';
import { kv } from '@/lib/kv';

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

    // 合并策略：比较 updatedAt，保留更新的数据
    const existingData = JSON.parse(existing as string);
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

// 智能合并：词汇表取并集，阅读进度取较大值
function mergeData(remote: Record<string, unknown>, local: Record<string, unknown>) {
  // 合并词汇表（并集，保留 correctCount 较大的）
  const mergedVocab: Record<string, unknown> = { ...(remote.vocabulary as Record<string, unknown> || {}) };
  for (const [key, value] of Object.entries(local.vocabulary as Record<string, unknown> || {})) {
    const v = value as { correctCount?: number };
    if (!mergedVocab[key]) {
      mergedVocab[key] = v;
    } else {
      // 保留 correctCount 较大的
      if ((v.correctCount || 0) > ((mergedVocab[key] as { correctCount?: number }).correctCount || 0)) {
        mergedVocab[key] = v;
      }
    }
  }

  // 合并阅读进度（取较大值）
  const mergedProgress: Record<string, unknown> = { ...(remote.bookProgress as Record<string, unknown> || {}) };
  for (const [bookId, progress] of Object.entries(local.bookProgress as Record<string, unknown> || {})) {
    const p = progress as { lastScrollPosition?: number };
    if (!mergedProgress[bookId]) {
      mergedProgress[bookId] = p;
    } else {
      // 取阅读进度较大的
      if ((p.lastScrollPosition || 0) > ((mergedProgress[bookId] as { lastScrollPosition?: number }).lastScrollPosition || 0)) {
        mergedProgress[bookId] = p;
      }
    }
  }

  return {
    vocabulary: mergedVocab,
    bookProgress: mergedProgress,
    settings: (local.settings || remote.settings) as Record<string, unknown>,
  };
}
