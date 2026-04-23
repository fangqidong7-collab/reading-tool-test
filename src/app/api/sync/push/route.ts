import { NextResponse } from 'next/server';
import { kv } from '@/lib/kv';
import { parseJsonRequestBody, jsonResponseMaybeGzip } from '@/lib/syncRequest.server';

export const maxDuration = 60;

interface BookManifestEntry {
  id: string;
  title: string;
  contentHash: string;
}

interface SyncData {
  vocabulary?: Record<string, unknown>;
  bookProgress?: Record<string, unknown>;
  books?: Array<Record<string, unknown>>;
  updatedAt?: number;
  createdAt?: number;
}

/**
 * 从云端 books 生成 manifest 供客户端比较。
 */
function buildCloudManifest(cloudBooks: Array<Record<string, unknown>>): Array<{ id: string; title: string }> {
  return cloudBooks.map(b => ({
    id: String(b.id ?? ''),
    title: String(b.title ?? ''),
  }));
}

/**
 * 比较本地 bookManifest 与云端 books。
 * 按 ID 精确匹配，回退到 title 匹配。
 * 返回本地有但云端没有的书 ID 列表。
 */
function diffBookManifest(
  localManifest: BookManifestEntry[],
  cloudBooks: Array<Record<string, unknown>>,
): string[] {
  const cloudIdSet = new Set<string>();
  const cloudTitleSet = new Set<string>();
  for (const b of cloudBooks) {
    if (typeof b.id === 'string') cloudIdSet.add(b.id);
    if (typeof b.title === 'string') cloudTitleSet.add(b.title);
  }

  const missing: string[] = [];
  for (const entry of localManifest) {
    if (cloudIdSet.has(entry.id)) continue;
    if (cloudTitleSet.has(entry.title)) continue;
    missing.push(entry.id);
  }
  return missing;
}

export async function POST(request: Request) {
  let step = 'parse';
  try {
    const parsed = (await parseJsonRequestBody(request)) as {
      syncCode?: string;
      data?: SyncData;
      lastSyncAt?: number | null;
      bookManifest?: BookManifestEntry[];
    };
    const { syncCode, data, lastSyncAt, bookManifest } = parsed;

    if (!syncCode || !data) {
      return NextResponse.json({ error: 'syncCode and data required' }, { status: 400 });
    }

    step = 'read';
    const key = `sync:${syncCode.toUpperCase()}`;
    const existing = await kv.get(key);

    if (!existing) {
      return NextResponse.json({ error: '同步码不存在或已过期，请重新生成' }, { status: 404 });
    }

    step = 'compare';
    const cloudData: SyncData = JSON.parse(existing as string);
    const cloudUpdatedAt = cloudData.updatedAt ?? 0;
    const localSyncAt = lastSyncAt ?? 0;

    if (cloudUpdatedAt > localSyncAt) {
      const cloudBookManifest = buildCloudManifest(cloudData.books ?? []);
      return jsonResponseMaybeGzip({
        action: 'pull',
        data: {
          vocabulary: cloudData.vocabulary,
          bookProgress: cloudData.bookProgress,
          updatedAt: cloudData.updatedAt,
        },
        cloudBookManifest,
      });
    }

    step = 'bookCompare';
    const manifest = bookManifest ?? [];
    const cloudBooks = cloudData.books ?? [];

    if (manifest.length > 0) {
      const missingIds = diffBookManifest(manifest, cloudBooks);

      if (missingIds.length > 0) {
        return jsonResponseMaybeGzip({ action: 'needBooks', missingBookIds: missingIds });
      }
    }

    step = 'save';
    const updatedAt = Date.now();
    const payload: SyncData = {
      vocabulary: data.vocabulary,
      bookProgress: data.bookProgress,
      books: cloudBooks,
      updatedAt,
    };

    await kv.set(key, JSON.stringify(payload), { ex: 90 * 24 * 60 * 60 });

    step = 'respond';
    return jsonResponseMaybeGzip({ action: 'push', updatedAt });
  } catch (error) {
    console.error(`[sync/push@${step}]`, error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `同步推送失败 (${step}): ${detail}` },
      { status: 500 },
    );
  }
}
