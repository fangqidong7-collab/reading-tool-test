/// <reference lib="webworker" />

import {
  runProcessBookLoop,
  splitRawParagraphs,
  type ProcessTextOptions,
} from '@/lib/processBookContentCore';
import type { ProcessedContent } from '@/hooks/useBookshelf';

interface ProcessRequest {
  type: 'process';
  requestId: number;
  text: string;
  initialBatch?: number;
}

interface ProcessResponse {
  type: 'partial' | 'done' | 'error';
  requestId: number;
  content?: ProcessedContent;
  message?: string;
}

self.onmessage = (event: MessageEvent<ProcessRequest>) => {
  const msg = event.data;
  if (msg.type !== 'process') return;

  const options: ProcessTextOptions = {
    initialBatch: msg.initialBatch,
    onPartial: (partial) => {
      const res: ProcessResponse = {
        type: 'partial',
        requestId: msg.requestId,
        content: partial,
      };
      self.postMessage(res);
    },
  };

  (async () => {
    try {
      const rawParagraphs = splitRawParagraphs(msg.text);
      const result = await runProcessBookLoop(rawParagraphs, options);
      const res: ProcessResponse = {
        type: 'done',
        requestId: msg.requestId,
        content: result,
      };
      self.postMessage(res);
    } catch (err) {
      const res: ProcessResponse = {
        type: 'error',
        requestId: msg.requestId,
        message: err instanceof Error ? err.message : 'Worker process failed',
      };
      self.postMessage(res);
    }
  })();
};
