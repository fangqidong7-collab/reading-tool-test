/**
 * Clean translation text - remove parts of speech and extra info
 */
export function cleanTranslation(text: string): string {
  if (!text) return "";

  let cleaned = text;

  // Remove leading parts of speech like "n. " "v. " "adj. " etc.
  // Common patterns: "n.", "v.", "adj.", "adv.", "prep.", "conj.", "pron.", "det.", "vi.", "vt.", "n.v.", etc.
  cleaned = cleaned.replace(/^[a-z]+\.(?:\/[a-z]+\.)*\s*/gi, '');

  // Remove leading Chinese parts of speech
  cleaned = cleaned.replace(/^(名词|动词|形容词|副词|介词|连词|代词|冠词|感叹词|数词|前缀|后缀)[;；\s]*/g, '');

  // Remove leading dots and colons
  cleaned = cleaned.replace(/^[.。:：]+/, '');

  // Remove content in brackets like [计], [军], etc.
  cleaned = cleaned.replace(/\[[^\]]+\]/g, '');

  // Remove multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ');

  // Remove leading/trailing punctuation that might be left
  cleaned = cleaned.replace(/^[，。、；：.!?,]+/, '').replace(/[，。、；：.!?,]+$/, '');

  return cleaned.trim();
}

/**
 * Shorten translation text - keep only 1-2 most concise meanings
 * This is used to prevent overly long annotations like "(会话说话交谈)"
 * @param text - The translation text
 * @param mode - 'zh' for Chinese mode, 'en' or 'en-simple' for English mode
 */
export function shortenTranslation(text: string, mode: 'zh' | 'en' | 'en-simple' = 'zh'): string {
  if (!text) return (mode === 'en' || mode === 'en-simple') ? 'No definition' : '未知';

  // First, clean the text (remove POS tags, brackets, etc.)
  let cleaned = text;
  cleaned = cleaned.replace(/^[a-z]+\.(?:\/[a-z]+\.)*\s*/gi, '');
  cleaned = cleaned.replace(/^(名词|动词|形容词|副词|介词|连词|代词|冠词|感叹词|数词|前缀|后缀)[;；\s]*/g, '');
  cleaned = cleaned.replace(/^[.。:：]+/, '');
  cleaned = cleaned.replace(/\[[^\]]+\]/g, '');
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/^[，。、；：.!?,]+/, '').replace(/[，。、；：.!?,]+$/, '');
  cleaned = cleaned.trim();

  if (!cleaned) return (mode === 'en' || mode === 'en-simple') ? 'No definition' : '未知';

  if (mode === 'en' || mode === 'en-simple') {
    return cleaned || 'No definition';
  }

  // Chinese mode (original logic)
  // Split by various separators first
  let items = cleaned.split(/[;；,，、/\n\\n]+/);

  // If only one item and it's all Chinese with no separators, smart split it
  if (items.length === 1 && /^[\u4e00-\u9fff]+$/.test(items[0])) {
    const str = items[0];
    // Split by common word boundaries (2-4 chars each)
    const newItems: string[] = [];
    for (let i = 0; i < str.length; i += 2) {
      newItems.push(str.substring(i, Math.min(i + 3, str.length)));
    }
    items = newItems;
  }

  // Clean each item and filter: must have Chinese characters, max 6 chars each
  items = items
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 6)
    .filter((s) => /[\u4e00-\u9fff]/.test(s));

  // Take first 2 items
  items = items.slice(0, 2);

  if (items.length === 0) {
    // Fallback: be more lenient, just take first 2 parts and extract Chinese
    const parts = cleaned.split(/[;；,，、/\n\\n]+/);
    items = parts
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, 2);
    // Extract Chinese characters only, max 4 chars each
    items = items
      .map((s) => {
        const chinese = s.replace(/[^\u4e00-\u9fff]/g, '');
        return chinese.substring(0, 4);
      })
      .filter((s) => s.length > 0);
  }

  return items.length > 0 ? items.join(',') : '未知';
}
