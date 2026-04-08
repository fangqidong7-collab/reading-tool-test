// 翻译缓存
const translationCache: Record<string, string> = {};

/**
 * 翻译英文单词为中文
 */
export async function translateWord(word: string): Promise<string> {
  const lowerWord = word.toLowerCase().trim();
  
  // 检查缓存
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
    const translation = data.translation || "未找到释义";
    
    // 缓存结果
    translationCache[lowerWord] = translation;
    
    return translation;
  } catch (error) {
    console.error("Translation error:", error);
    return "翻译失败";
  }
}
