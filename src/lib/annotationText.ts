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
 * 精简释义用于标注展示：
 * - 英文模式：保留清理后的全文
 * - 中文模式：按 `；、，` 等分隔成义项，只取前 **2** 条完整义项（不再按字数切块，以免截断语义）
 */
export function shortenTranslation(text: string, mode: 'zh' | 'en' = 'zh'): string {
  if (!text) return mode === 'en' ? 'No definition' : '未知';

  let cleaned = text;
  cleaned = cleaned.replace(/^[a-z]+\.(?:\/[a-z]+\.)*\s*/gi, '');
  cleaned = cleaned.replace(/^(名词|动词|形容词|副词|介词|连词|代词|冠词|感叹词|数词|前缀|后缀)[;；\s]*/g, '');
  cleaned = cleaned.replace(/^[.。:：]+/, '');
  cleaned = cleaned.replace(/\[[^\]]+\]/g, '');
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/^[，。、；：.!?,]+/, '').replace(/[，。、；：.!?,]+$/, '');
  cleaned = cleaned.trim();

  if (!cleaned) return mode === 'en' ? 'No definition' : '未知';

  if (mode === 'en') {
    return cleaned || 'No definition';
  }

  // 中文：按分隔符拆义项，优先保留含汉字的片段
  let items = cleaned
    .split(/[;；,，、/\n\\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const withCjk = items.filter((s) => /[\u4e00-\u9fff]/.test(s));
  if (withCjk.length > 0) {
    items = withCjk;
  }

  items = items.slice(0, 2);

  if (items.length === 0 && /[\u4e00-\u9fff]/.test(cleaned)) {
    items = [cleaned];
  }

  return items.length > 0 ? items.join(',') : '未知';
}
