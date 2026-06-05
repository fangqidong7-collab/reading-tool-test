import type { ProcessedContent } from '@/hooks/useBookshelf';
import {
  runProcessBookLoop,
  splitRawParagraphs,
  type ProcessTextOptions,
} from '@/lib/processBookContentCore';

let worker: Worker | null = null;
let workerFailed = false;
let requestId = 0;

function getWorker(): Worker | null {
  if (workerFailed || typeof window === 'undefined' || typeof Worker === 'undefined') {
    return null;
  }
  if (!worker) {
    try {
      worker = new Worker(new URL('../workers/processBook.worker.ts', import.meta.url));
      worker.onerror = () => {
        workerFailed = true;
        worker?.terminate();
        worker = null;
      };
    } catch {
      workerFailed = true;
      return null;
    }
  }
  return worker;
}

async function processOnMainThread(
  text: string,
  options?: ProcessTextOptions,
): Promise<ProcessedContent> {
  const rawParagraphs = splitRawParagraphs(text);
  return runProcessBookLoop(rawParagraphs, options);
}

function processInWorker(
  text: string,
  options?: ProcessTextOptions,
): Promise<ProcessedContent> {
  const w = getWorker();
  if (!w) {
    return processOnMainThread(text, options);
  }

  const id = ++requestId;

  return new Promise((resolve, reject) => {
    const handleMessage = (event: MessageEvent<{
      type: string;
      requestId: number;
      content?: ProcessedContent;
      message?: string;
    }>) => {
      const msg = event.data;
      if (msg.requestId !== id) return;

      if (msg.type === 'partial' && msg.content && options?.onPartial) {
        options.onPartial(msg.content);
        return;
      }

      if (msg.type === 'done' && msg.content) {
        w.removeEventListener('message', handleMessage);
        resolve(msg.content);
        return;
      }

      if (msg.type === 'error') {
        w.removeEventListener('message', handleMessage);
        reject(new Error(msg.message || 'Worker process failed'));
      }
    };

    w.addEventListener('message', handleMessage);
    w.postMessage({
      type: 'process',
      requestId: id,
      text,
      initialBatch: options?.initialBatch ?? 0,
    });
  });
}

export async function processTextToSegmentsAsync(
  text: string | undefined | null,
  options?: ProcessTextOptions,
): Promise<ProcessedContent> {
  if (!text) return [];

  try {
    return await processInWorker(text, options);
  } catch {
    workerFailed = true;
    if (worker) {
      worker.terminate();
      worker = null;
    }
    return processOnMainThread(text, options);
  }
}
