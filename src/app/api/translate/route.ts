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
        content: `翻译英文单词 "${word}" 为中文。请严格遵循以下格式要求：
1. 只返回翻译结果，不要任何解释
2. 只给出最常用的1-2个词义，用分号分隔
3. 格式：中文释义（词性）
4. 示例格式："快乐（adj.）；幸福（n.）"
5. 如果只有一个含义就不需要分号："跑（v.）"
请直接给出翻译：`,
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
