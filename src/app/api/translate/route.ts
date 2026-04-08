import { LLMClient } from 'coze-coding-dev-sdk';
import { NextRequest, NextResponse } from 'next/server';

const llmClient = new LLMClient();

export async function POST(request: NextRequest) {
  try {
    const { word } = await request.json();
    
    if (!word || typeof word !== 'string') {
      return NextResponse.json({ error: 'Word is required' }, { status: 400 });
    }
    
    const response = await llmClient.invoke([
      {
        role: 'user',
        content: `请翻译以下英文单词为中文，只需给出翻译结果，格式为"中文释义 (词性)"，如果有多含义请用分号分隔：${word}`,
      },
    ], {
      model: 'doubao-seed-1-6-lite-251015',
    });
    
    return NextResponse.json({ translation: response.content });
  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json(
      { error: 'Translation failed' },
      { status: 500 }
    );
  }
}
