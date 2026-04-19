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

    if (headingMatch) {
      const level = parseInt(headingMatch[1], 10);
      const headingText = headingMatch[2].trim();

      if (headingText) {
        const segments: ProcessedSegment[] = [];
        const regex = /([a-zA-Z]+|[^a-zA-Z\s]+|\s+)/g;
        let segMatch;

        while ((segMatch = regex.exec(headingText)) !== null) {
          const token = segMatch[0];
          if (/^\s+$/.test(token)) {
            segments.push({ text: token, lemma: "", type: "space" });
          } else if (/^[a-zA-Z]+$/.test(token)) {
            segments.push({ text: token, lemma: lemmatize(token.toLowerCase()), type: "word" });
          } else {
            segments.push({ text: token, lemma: "", type: "punctuation" });
          }
        }

        result.push({ segments, headingLevel: level });
      }
    } else {
      const segments: ProcessedSegment[] = [];
      const regex = /([a-zA-Z]+|[^a-zA-Z\s]+|\s+)/g;
      let segMatch;

      while ((segMatch = regex.exec(trimmed)) !== null) {
        const token = segMatch[0];
        if (/^\s+$/.test(token)) {
          segments.push({ text: token, lemma: "", type: "space" });
        } else if (/^[a-zA-Z]+$/.test(token)) {
          segments.push({ text: token, lemma: lemmatize(token.toLowerCase()), type: "word" });
        } else {
          segments.push({ text: token, lemma: "", type: "punctuation" });
        }
      }

      result.push({ segments });
    }

    if (i > 0 && i % CHUNK_SIZE === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return result;
}
