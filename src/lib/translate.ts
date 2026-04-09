// Translation cache
const translationCache: Record<string, string> = {};
const translationCacheEn: Record<string, string> = {};

/**
 * Post-process translation on client side (fallback)
 */
function postProcessTranslation(translation: string, maxLength: number = 15): string {
  let result = translation
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .trim();
  
  // Remove common filler phrases
  const fillers = [
    /^意思是[：:]/,
    /^中文意思是[：:]/,
    /^翻译[：:]/,
    /^英文单词[：:]/,
    /^表示[：:]/,
    /^(这个|该)?(词|单词|词的意思|含义)是[：:]/,
  ];
  
  for (const filler of fillers) {
    result = result.replace(filler, '');
  }
  
  result = result.trim();
  
  // Truncate if too long (count Chinese characters)
  const chineseChars = (result.match(/[\u4e00-\u9fa5]/g) || []).length;
  
  if (chineseChars > maxLength) {
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
 * Post-process English translation (simpler truncation)
 */
function postProcessTranslationEn(translation: string, maxLength: number = 60): string {
  let result = translation
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
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
  
  // Truncate if too long (count characters)
  if (result.length > maxLength) {
    result = result.substring(0, maxLength).trim() + '...';
  }
  
  return result;
}

/**
 * Translate English word to Chinese
 */
export async function translateWord(word: string): Promise<string> {
  const lowerWord = word.toLowerCase().trim();
  
  // Check cache first
  if (translationCache[lowerWord]) {
    return translationCache[lowerWord];
  }
  
  try {
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ word: lowerWord }),
    });
    
    if (!response.ok) {
      throw new Error("Translation API error");
    }
    
    const data = await response.json();
    let translation = data.translation || "未找到释义";
    
    // Additional client-side post-processing as fallback
    if (translation && translation.length > 20) {
      translation = postProcessTranslation(translation);
    }
    
    // Cache the result
    translationCache[lowerWord] = translation;
    
    return translation;
  } catch (error) {
    console.error("Translation error:", error);
    return "翻译失败";
  }
}

/**
 * Translate English word to English definition
 */
export async function translateWordEn(word: string): Promise<string> {
  const lowerWord = word.toLowerCase().trim();
  
  // Check cache first
  if (translationCacheEn[lowerWord]) {
    return translationCacheEn[lowerWord];
  }
  
  try {
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ word: lowerWord, lang: "en" }),
    });
    
    if (!response.ok) {
      throw new Error("Translation API error");
    }
    
    const data = await response.json();
    let translation = data.translation || "No definition found";
    
    // Post-process English translation
    if (translation && translation.length > 20) {
      translation = postProcessTranslationEn(translation);
    }
    
    // Cache the result
    translationCacheEn[lowerWord] = translation;
    
    return translation;
  } catch (error) {
    console.error("Translation error:", error);
    return "Definition unavailable";
  }
}
