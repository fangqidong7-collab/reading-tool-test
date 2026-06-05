import { formatBytes } from '@/lib/syncSizeLimit';

export type BookSizeComfort = 'comfortable' | 'ok' | 'heavy';

const COMFORTABLE_MAX = 500 * 1024;
const OK_MAX = 1.5 * 1024 * 1024;

export function getBookSizeComfort(charLength: number): BookSizeComfort {
  if (charLength <= COMFORTABLE_MAX) return 'comfortable';
  if (charLength <= OK_MAX) return 'ok';
  return 'heavy';
}

export function estimateProcessedMemoryBytes(charLength: number): number {
  // 分词结果约为原文字节数的 2–3 倍（对象开销）
  return Math.round(charLength * 2.5);
}

export function estimateTextBytes(charLength: number): number {
  // JS 字符串为 UTF-16，约 2 字节/字符
  return charLength * 2;
}

export function formatBookSizeHint(charLength: number): string {
  const textBytes = estimateTextBytes(charLength);
  const processedBytes = estimateProcessedMemoryBytes(charLength);
  const comfort = getBookSizeComfort(charLength);

  const comfortLabel: Record<BookSizeComfort, string> = {
    comfortable: '预计阅读流畅',
    ok: '预计可正常使用，开书可能稍慢',
    heavy: '体积较大，开书与分词可能较慢，建议 Wi‑Fi 环境使用',
  };

  return `原文约 ${formatBytes(textBytes)}，分词后内存约 ${formatBytes(processedBytes)}。${comfortLabel[comfort]}`;
}
