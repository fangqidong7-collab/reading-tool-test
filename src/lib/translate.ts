// Translation cache (with sessionStorage persistence)
let translationCache: Record<string, string> = {};

try {
  const saved = sessionStorage.getItem('translation_cache');
  if (saved) translationCache = JSON.parse(saved);
} catch {}

function saveCacheToSession() {
  try {
    sessionStorage.setItem('translation_cache', JSON.stringify(translationCache));
  } catch {}
}

/**
 * Post-process Chinese translation
 */
function postProcessTranslation(
  translation: string,
  maxLength: number = 15
): string {
  let result = translation
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/`/g, "")
    .trim();

  const fillers = [
    /^意思是[：:]/,
    /^中文意思是[：:]/,
    /^翻译[：:]/,
    /^英文单词[：:]/,
    /^表示[：:]/,
    /^(这个|该)?(词|单词|词的意思|含义)是[：:]/,
  ];

  for (const filler of fillers) {
    result = result.replace(filler, "");
  }

  result = result.trim();

  const chineseChars = (result.match(/[\u4e00-\u9fa5]/g) || []).length;
  if (chineseChars > maxLength) {
    let truncAt = 0;
    let count = 0;
    for (let i = 0; i < result.length && count < maxLength; i++) {
      const char = result[i];
      if (/[\u4e00-\u9fa5]/.test(char)) count++;
      truncAt = i + 1;
    }
    result = result.substring(0, truncAt) + "...";
  }

  return result;
}

/**
 * Post-process English definition
 */
function postProcessTranslationEn(
  translation: string,
  maxLength: number = 60
): string {
  let result = translation
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/`/g, "")
    .trim();

  const fillers = [
    /^The word ["']?/i,
    /^["']/i,
    /^Definition[:\s]*/i,
    /^Meaning[:\s]*/i,
    /^It (means|refers to|is|represents)[:\s]*/i,
    /^This word (means|refers to|is|represents)[:\s]*/i,
  ];

  for (const filler of fillers) {
    result = result.replace(filler, "");
  }

  result = result.trim();

  if (result.length > maxLength) {
    result = result.substring(0, maxLength).trim() + "...";
  }

  return result;
}

async function requestTranslation(
  word: string,
  lang: "zh" | "en" | "en-simple" = "zh"
): Promise<string> {
  const lowerWord = word.toLowerCase().trim();
  const cacheKey = `${lang}:${lowerWord}`;

  if (translationCache[cacheKey]) {
    return translationCache[cacheKey];
  }

  const isEnglishLang = lang === "en" || lang === "en-simple";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch("/api/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ word: lowerWord, lang }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error("Translation API error");
    }

    const data = await response.json();

    let translation =
      data.translation || (isEnglishLang ? "No definition found" : "未找到释义");

    translation = isEnglishLang
      ? postProcessTranslationEn(translation, lang === "en-simple" ? 150 : 60)
      : postProcessTranslation(translation);

    translationCache[cacheKey] = translation;
    saveCacheToSession();
    return translation;
  } catch (error) {
    console.error("Translation error:", error);
    return isEnglishLang ? "Definition failed" : "翻译失败";
  }
}

/**
 * Translate English word to Chinese
 */
export async function translateWord(word: string): Promise<string> {
  return requestTranslation(word, "zh");
}

/**
 * Define English word in English (short)
 */
export async function translateWordEn(word: string): Promise<string> {
  return requestTranslation(word, "en");
}

/**
 * Define English word in easy English (longer, using basic vocabulary)
 */
export async function translateWordEnSimple(word: string): Promise<string> {
  return requestTranslation(word, "en-simple");
}

/**
 * Translate an English sentence to Chinese
 */
export async function translateSentence(sentence: string): Promise<string> {
  const trimmed = sentence.trim();
  const cacheKey = `sentence:${trimmed}`;

  if (translationCache[cacheKey]) {
    return translationCache[cacheKey];
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "sentence", sentence: trimmed }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error("Sentence translation API error");
    }

    const data = await response.json();
    const translation = data.translation || "翻译失败";

    translationCache[cacheKey] = translation;
    saveCacheToSession();
    return translation;
  } catch (error) {
    console.error("Sentence translation error:", error);
    return "翻译失败";
  }
}
