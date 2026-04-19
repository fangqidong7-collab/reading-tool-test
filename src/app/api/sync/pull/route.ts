import { NextResponse } from 'next/server';
import { kv } from '@/lib/kv';

export async function POST(request: Request) {
  try {
    const { syncCode } = await request.json();

    if (!syncCode) {
      return NextResponse.json({ error: 'syncCode required' }, { status: 400 });
    }

    const key = `sync:${syncCode.toUpperCase()}`;
    const data = await kv.get(key);

    if (!data) {
      return NextResponse.json({ error: 'Invalid sync code or expired' }, { status: 404 });
    }

    return NextResponse.json({ data: JSON.parse(data as string) });
  } catch (error) {
    console.error('Pull sync error:', error);
    return NextResponse.json({ error: 'Pull failed' }, { status: 500 });
  }
}
