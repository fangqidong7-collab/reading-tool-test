import { NextResponse } from 'next/server';
import { kv } from '@/lib/kv';
import { parseJsonRequestBody, jsonResponseMaybeGzip } from '@/lib/syncRequest.server';

export const maxDuration = 60;

interface Book {
  id: string;
  title: string;
  content?: string;
  _contentOmitted?: boolean;
  _contentHash?: string;
  [key: string]: unknown;
}

interface SyncData {
  vocabulary?: Record<string, unknown>;
  bookProgress?: Record<string, unknown>;
  books?: Book[];
  updatedAt?: number;
}

function normalizeBookForKv(book: Book): Book {
  const copy = { ...(book as unknown as Record<string, unknown>) };
  delete copy._contentOmitted;
  delete copy._contentHash;
  return copy as unknown as Book;
}

/**
 * 补传书籍：客户端发送缺失的书籍正文，服务端追加到已有云端数据中。
 * 按 ID 替换已有的，否则追加。
 */
export async function POST(request: Request) {
  let step = 'parse';
  try {
    const parsed = (await parseJsonRequestBody(request)) as {
      syncCode?: string;
      books?: Book[];
    };
    const { syncCode, books } = parsed;

    if (!syncCode || !Array.isArray(books)) {
      return NextResponse.json({ error: 'syncCode and books required' }, { status: 400 });
    }

    step = 'read';
    const key = `sync:${syncCode.toUpperCase()}`;
    const existing = await kv.get(key);

    if (!existing) {
      return NextResponse.json({ error: '同步码不存在或已过期，请重新生成' }, { status: 404 });
    }

    step = 'parse-kv';
    let cloudData: SyncData;
    if (typeof existing === 'string') {
      cloudData = JSON.parse(existing) as SyncData;
    } else {
      cloudData = existing as SyncData;
    }

    step = 'merge';
    const cloudBooks = cloudData.books ?? [];

    const cloudById = new Map<string, number>();
    for (let i = 0; i < cloudBooks.length; i++) {
      cloudById.set(cloudBooks[i].id, i);
    }

    const updatedBooks = [...cloudBooks];
    for (const book of books) {
      const normalized = normalizeBookForKv(book);
      const idx = cloudById.get(normalized.id);
      if (idx !== undefined) {
        updatedBooks[idx] = normalized;
      } else {
        updatedBooks.push(normalized);
      }
    }

    const updatedAt = Date.now();
    const payload: SyncData = {
      ...cloudData,
      books: updatedBooks,
      updatedAt,
    };

    step = 'save';
    await kv.set(key, JSON.stringify(payload), { ex: 90 * 24 * 60 * 60 });

    step = 'respond';
    return jsonResponseMaybeGzip({ action: 'push', updatedAt });
  } catch (error) {
    console.error(`[sync/push-books@${step}]`, error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `书籍推送失败 (${step}): ${detail}` },
      { status: 500 },
    );
  }
}
