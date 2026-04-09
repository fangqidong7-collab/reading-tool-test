import { LLMClient } from 'coze-coding-dev-sdk';
import { NextRequest, NextResponse } from 'next/server';

const llmClient = new LLMClient();

/**
 * Post-process AI translation result (Chinese)
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

/**
 * Post-process English translation
 * - Remove markdown formatting
 * - Truncate if too long (>60 chars)
 * - Keep it simple and clean
 */
function postProcessTranslationEn(translation: string, maxLength: number = 60): string {
  // Remove markdown formatting
  let result = translation
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .trim();
  
  // Remove common filler phrases for English
  const fillers = [
    /^The word ["']/i,
    /^["']/i,
    /^Definition[:\s]*/i,
    /^Meaning[:\s]*/i,
    /^It (means|refers to|is|represents)[:\s]*/i,
    /^This word (means|refers to|is|represents)[:\s]*/i,
  ];
  
  for (const filler of fillers) {
    result = result.replace(filler, '');
  }
  
  result = result.trim();
  
  // Truncate if too long
  if (result.length > maxLength) {
    result = result.substring(0, maxLength).trim() + '...';
  }
  
  return result;
}

export async function POST(request: NextRequest) {
  try {
    const { word, lang } = await request.json();
    
    if (!word || typeof word !== 'string') {
      return NextResponse.json({ error: 'Word is required' }, { status: 400 });
    }
    
    const cleanWord = word.toLowerCase().trim();
    const isEnglishMode = lang === 'en';
    
    let response;
    if (isEnglishMode) {
      // English definition mode
      response = await llmClient.invoke([
        {
          role: 'user',
          content: `Define the English word "${cleanWord}" in simple English. Give only a brief definition, no more than 10 words. Do not include the word itself in the definition.`,
        },
      ], {
        model: 'doubao-seed-1-6-lite-251015',
      });
      
      const rawTranslation = response.content || '';
      const processedTranslation = postProcessTranslationEn(rawTranslation);
      
      return NextResponse.json({ 
        translation: processedTranslation || 'No definition found',
        raw: rawTranslation
      });
    } else {
      // Chinese translation mode (default)
      response = await llmClient.invoke([
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
    }
  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json(
      { error: 'Translation failed' },
      { status: 500 }
    );
  }
}
