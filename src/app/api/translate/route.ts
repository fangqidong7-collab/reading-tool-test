import { LLMClient } from 'coze-coding-dev-sdk';
import { NextRequest, NextResponse } from 'next/server';

const llmClient = new LLMClient();

/**
 * Post-process AI translation result
 * - Remove markdown formatting
 * - Truncate if too long (>15 chars)
 * - Remove common filler words
 */
function postProcessTranslation(translation: string, maxLength: number = 15): string {
  // Remove markdown formatting
  let result = translation
    .replace(/\*\*/g, '')  // Remove bold markers
    .replace(/\*/g, '')     // Remove italic markers
    .replace(/`/g, '')     // Remove code markers
    .trim();
  
  // Remove common filler phrases
  const fillers = [
    /^意思是[：:]/,
    /^中文意思是[：:]/,
    /^翻译[：:]/,
    /^英文单词[：:]/,
    /^表示[：:]/,
    /^(这个|该)?(词|单词|词的意思|含义)是[：:]/,
    /^(这个|该)?(词|单词)是[：:]/,
  ];
  
  for (const filler of fillers) {
    result = result.replace(filler, '');
  }
  
  // Remove anything in parentheses except the part of speech
  result = result.replace(/\([^)]*\)/g, (match) => {
    // Keep only short parts like (n.), (v.), etc.
    if (/^\([a-zA-Z.]+\)$/.test(match)) {
      return '';
    }
    return '';
  });
  
  result = result.trim();
  
  // Truncate if too long
  // Count Chinese characters
  const chineseChars = (result.match(/[\u4e00-\u9fa5]/g) || []).length;
  
  // If result has many Chinese characters, truncate at maxLength
  if (chineseChars > maxLength) {
    // Find a good break point
    let truncAt = 0;
    let count = 0;
    for (let i = 0; i < result.length && count < maxLength; i++) {
      const char = result[i];
      if (/[\u4e00-\u9fa5]/.test(char)) {
        count++;
      }
      truncAt = i + 1;
    }
    result = result.substring(0, truncAt) + '...';
  }
  
  return result;
}

export async function POST(request: NextRequest) {
  try {
    const { word } = await request.json();
    
    if (!word || typeof word !== 'string') {
      return NextResponse.json({ error: 'Word is required' }, { status: 400 });
    }
    
    const cleanWord = word.toLowerCase().trim();
    
    // Optimized prompt: request concise, focused translation
    const response = await llmClient.invoke([
      {
        role: 'user',
        content: `翻译英文单词 "${cleanWord}" 为中文，只返回1-2个最常用中文词义，用分号分隔。不要解释，不要例句。`,
      },
    ], {
      model: 'doubao-seed-1-6-lite-251015',
    });
    
    // Post-process the translation
    const rawTranslation = response.content || '';
    const processedTranslation = postProcessTranslation(rawTranslation);
    
    return NextResponse.json({ 
      translation: processedTranslation || '未找到释义',
      raw: rawTranslation // Keep raw for debugging
    });
  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json(
      { error: 'Translation failed' },
      { status: 500 }
    );
  }
}
