// Translation cache
const translationCache: Record<string, string> = {};

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
