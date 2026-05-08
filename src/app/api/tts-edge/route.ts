import { EdgeTTS } from '@andresaya/edge-tts';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, rate = 0, voice = 'en-US-AriaNeural' } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    const trimmed = text.trim().slice(0, 500);

    const tts = new EdgeTTS();
    const rateStr = rate === 0 ? '0%' : `${rate > 0 ? '+' : ''}${rate}%`;

    await tts.synthesize(trimmed, voice, {
      rate: rateStr,
      outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
    });

    const base64 = tts.toBase64();
    const audioBuffer = Buffer.from(base64, 'base64');

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioBuffer.length),
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Edge-TTS] error:', msg);
    return NextResponse.json(
      { error: 'Edge TTS failed', message: msg },
      { status: 500 }
    );
  }
}
