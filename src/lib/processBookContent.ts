import type { ProcessedContent, ProcessedSegment, ProcessedParagraph } from "@/hooks/useBookshelf";
import { lemmatize } from "@/lib/dictionary";

/**
 * Process text into structured segments with lemmas.
 * Handles EPUB heading markers like [H2]Chapter 1[/H2]
 */
export async function processTextToSegmentsAsync(
  text: string | undefined | null
): Promise<ProcessedContent> {
  if (!text) return [];

  const rawParagraphs = text.split(/\n\n+/).filter((p) => p.trim());
  const result: ProcessedParagraph[] = [];
  const CHUNK_SIZE = 100;

  for (let i = 0; i < rawParagraphs.length; i++) {
    const trimmed = rawParagraphs[i].trim();
    if (!trimmed) continue;

    const headingMatch = trimmed.match(/^\[H(\d)\]([\s\S]*?)\[\/H\d\]$/);

    const tokenize = (input: string): ProcessedSegment[] => {
      const segs: ProcessedSegment[] = [];
      const regex = /([a-zA-Z]+(?:['\u2019][a-zA-Z]+)*|[^a-zA-Z\s]+|\s+)/g;
      let m;
      while ((m = regex.exec(input)) !== null) {
        const token = m[0];
        if (/^\s+$/.test(token)) {
          segs.push({ text: token, lemma: "", type: "space" });
        } else if (/^[a-zA-Z]/.test(token)) {
          // 所有格 's / ’s 单独切出，让前面的词依然可点击（Cloister's → Cloister + 's）
          const possessive = token.match(/^([a-zA-Z]+)(['\u2019]s)$/);
          if (possessive) {
            const baseWord = possessive[1];
            segs.push({
              text: baseWord,
              lemma: lemmatize(baseWord.toLowerCase()),
              type: "word",
            });
            segs.push({ text: possessive[2], lemma: "", type: "punctuation" });
            continue;
          }
          // 真·缩写（haven't / I'm / you're / it's …）保留为整体不可点击 punctuation
          const isContraction = /['\u2019]/.test(token);
          segs.push({
            text: token,
            lemma: isContraction ? "" : lemmatize(token.toLowerCase()),
            type: isContraction ? "punctuation" : "word",
          });
        } else {
          segs.push({ text: token, lemma: "", type: "punctuation" });
        }
      }
      return segs;
    };

    if (headingMatch) {
      const level = parseInt(headingMatch[1], 10);
      const headingText = headingMatch[2].trim();
      if (headingText) {
        result.push({ segments: tokenize(headingText), headingLevel: level });
      }
    } else {
      result.push({ segments: tokenize(trimmed) });
    }

    if (i > 0 && i % CHUNK_SIZE === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return result;
}
