import { NextResponse } from 'next/server';
import { kv } from '@/lib/kv';
import { parseJsonRequestBody, jsonResponseMaybeGzip } from '@/lib/syncRequest.server';

export const maxDuration = 60;

export async function POST(request: Request) {
  let step = 'parse';
  try {
    const parsed = (await parseJsonRequestBody(request)) as { syncCode?: string };
    const { syncCode } = parsed;

    if (!syncCode) {
      return NextResponse.json({ error: 'syncCode required' }, { status: 400 });
    }

    step = 'read';
    const key = `sync:${syncCode.toUpperCase()}`;
    const raw = await kv.get(key);

    if (!raw) {
      return NextResponse.json({ error: 'Invalid sync code or expired' }, { status: 404 });
    }

    step = 'parse-kv';
    let data: unknown;
    if (typeof raw === 'string') {
      data = JSON.parse(raw);
    } else {
      data = raw;
    }

    step = 'respond';
    return jsonResponseMaybeGzip({ data });
  } catch (error) {
    console.error(`[sync/pull@${step}]`, error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Pull failed (${step}): ${detail}` },
      { status: 500 },
    );
  }
}
