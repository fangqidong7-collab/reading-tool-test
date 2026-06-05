import type { ProcessedContent, ProcessedSegment, ProcessedParagraph } from '@/hooks/useBookshelf';
import { lemmatize } from '@/lib/dictionary';

export const INITIAL_PARAGRAPH_BATCH = 40;
export const CHUNK_YIELD_EVERY = 100;

function tokenizeParagraph(input: string): ProcessedSegment[] {
  const segs: ProcessedSegment[] = [];
  const regex = /([a-zA-Z]+(?:['\u2019][a-zA-Z]+)*|[^a-zA-Z\s]+|\s+)/g;
  let m;
  while ((m = regex.exec(input)) !== null) {
    const token = m[0];
    if (/^\s+$/.test(token)) {
      segs.push({ text: token, lemma: '', type: 'space' });
    } else if (/^[a-zA-Z]/.test(token)) {
      const possessive = token.match(/^([a-zA-Z]+)(['\u2019]s)$/);
      if (possessive) {
        const baseWord = possessive[1];
        segs.push({
          text: baseWord,
          lemma: lemmatize(baseWord.toLowerCase()),
          type: 'word',
        });
        segs.push({ text: possessive[2], lemma: '', type: 'punctuation' });
        continue;
      }
      const isContraction = /['\u2019]/.test(token);
      segs.push({
        text: token,
        lemma: isContraction ? '' : lemmatize(token.toLowerCase()),
        type: isContraction ? 'punctuation' : 'word',
      });
    } else {
      segs.push({ text: token, lemma: '', type: 'punctuation' });
    }
  }
  return segs;
}

function processRawParagraph(trimmed: string): ProcessedParagraph | null {
  const headingMatch = trimmed.match(/^\[H(\d)\]([\s\S]*?)\[\/H\d\]$/);
  if (headingMatch) {
    const level = parseInt(headingMatch[1], 10);
    const headingText = headingMatch[2].trim();
    if (!headingText) return null;
    return { segments: tokenizeParagraph(headingText), headingLevel: level };
  }
  return { segments: tokenizeParagraph(trimmed) };
}

export interface ProcessTextOptions {
  initialBatch?: number;
  onPartial?: (content: ProcessedContent) => void;
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * 核心分词循环，主线程与 Worker 共用。
 */
export async function runProcessBookLoop(
  rawParagraphs: string[],
  options?: ProcessTextOptions,
): Promise<ProcessedContent> {
  const result: ProcessedParagraph[] = [];
  const initialBatch = options?.initialBatch ?? 0;
  let partialEmitted = false;

  for (let i = 0; i < rawParagraphs.length; i++) {
    const trimmed = rawParagraphs[i].trim();
    if (!trimmed) continue;

    const para = processRawParagraph(trimmed);
    if (para) {
      result.push(para);
    }

    if (
      options?.onPartial &&
      !partialEmitted &&
      initialBatch > 0 &&
      result.length >= initialBatch
    ) {
      options.onPartial([...result]);
      partialEmitted = true;
    }

    if (i > 0 && i % CHUNK_YIELD_EVERY === 0) {
      await yieldToEventLoop();
    }
  }

  return result;
}

export function splitRawParagraphs(text: string): string[] {
  return text.split(/\n\n+/).filter((p) => p.trim());
}
