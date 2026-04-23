import { NextResponse } from 'next/server';
import { kv } from '@/lib/kv';
import { parseJsonRequestBody } from '@/lib/syncRequest.server';

export const maxDuration = 60;

function generateSyncCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

interface SyncDataPayload {
  vocabulary?: Record<string, unknown>;
  bookProgress?: Record<string, unknown>;
  books?: Array<Record<string, unknown>>;
}

function stripInternalBookFields(data: SyncDataPayload): SyncDataPayload {
  if (!Array.isArray(data.books)) return data;
  return {
    ...data,
    books: data.books.map((book) => {
      const copy = { ...book };
      delete copy._contentOmitted;
      delete copy._contentHash;
      return copy;
    }),
  };
}

export async function POST(request: Request) {
  try {
    const parsed = (await parseJsonRequestBody(request)) as { data?: SyncDataPayload };
    const { data } = parsed;

    if (!data) {
      return NextResponse.json({ error: 'Data is required' }, { status: 400 });
    }

    let syncCode = generateSyncCode();
    let attempts = 0;
    while (await kv.get(`sync:${syncCode}`) && attempts < 10) {
      syncCode = generateSyncCode();
      attempts++;
    }

    const cleaned = stripInternalBookFields(data);
    await kv.set(`sync:${syncCode}`, JSON.stringify({
      ...cleaned,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }), { ex: 90 * 24 * 60 * 60 });

    return NextResponse.json({ syncCode });
  } catch (error) {
    console.error('[sync/create]', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to create sync: ${msg}` }, { status: 500 });
  }
}
