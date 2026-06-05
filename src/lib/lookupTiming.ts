export type LookupTimingSource =
  | 'dict-builtin'
  | 'dict-external'
  | 'ai-cache'
  | 'ai-network';

export interface LookupTimingRecord {
  source: LookupTimingSource;
  ms: number;
  at: number;
}

let lastLookupTiming: LookupTimingRecord | null = null;

export function recordLookupTiming(source: LookupTimingSource, ms: number): void {
  lastLookupTiming = { source, ms, at: Date.now() };
}

export function getLastLookupTiming(): LookupTimingRecord | null {
  return lastLookupTiming;
}

export function formatLookupTiming(record: LookupTimingRecord | null): string | null {
  if (!record) return null;
  const label: Record<LookupTimingSource, string> = {
    'dict-builtin': '内置词典',
    'dict-external': '外部词典',
    'ai-cache': 'AI缓存',
    'ai-network': 'AI联网',
  };
  return `${label[record.source]} ${Math.round(record.ms)}ms`;
}
