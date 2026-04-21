import { NextResponse } from 'next/server';
import { kv } from '@/lib/kv';
import { parseJsonRequestBody } from '@/lib/syncRequest.server';

export const maxDuration = 60;

// 生成 6 位随机同步码
function generateSyncCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉容易混淆的 0OI1
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function POST(request: Request) {
  try {
    const parsed = (await parseJsonRequestBody(request)) as { data?: unknown };
    const { data } = parsed;

    // data 包含: { vocabulary, bookProgress, settings, updatedAt }
    if (!data) {
      return NextResponse.json({ error: 'Data is required' }, { status: 400 });
    }

    // 生成唯一同步码（防碰撞）
    let syncCode = generateSyncCode();
    let attempts = 0;
    while (await kv.get(`sync:${syncCode}`) && attempts < 10) {
      syncCode = generateSyncCode();
      attempts++;
    }

    // 存储数据，设置 90 天过期
    await kv.set(`sync:${syncCode}`, JSON.stringify({
      ...data,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }), { ex: 90 * 24 * 60 * 60 });

    return NextResponse.json({ syncCode });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[sync/create]', error);
    }
    return NextResponse.json({ error: 'Failed to create sync' }, { status: 500 });
  }
}
