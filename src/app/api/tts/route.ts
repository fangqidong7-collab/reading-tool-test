import { TTSClient, Config } from 'coze-coding-dev-sdk';
import { NextRequest, NextResponse } from 'next/server';

const ttsClient = new TTSClient();

/**
 * POST /api/tts
 * Body: { text: string, speechRate?: number }
 * Returns: { audioUri: string, audioSize: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, speechRate = 0 } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    // Coze TTS text limit is ~300 chars per request
    // Long text will be handled by the caller splitting sentences
    const trimmed = text.trim().slice(0, 300);

    const response = await ttsClient.synthesize({
      uid: `tts-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: trimmed,
      speaker: 'zh_female_vv_uranus_bigtts', // Good for reading English
      audioFormat: 'mp3',
      sampleRate: 24000,
      speechRate: Math.max(-50, Math.min(100, speechRate)),
    });

    return NextResponse.json({
      audioUri: response.audioUri,
      audioSize: response.audioSize,
    });
  } catch (error: any) {
    console.error('[TTS] synthesize error:', error?.message ?? error);
    return NextResponse.json(
      { error: 'TTS failed', message: error?.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}
