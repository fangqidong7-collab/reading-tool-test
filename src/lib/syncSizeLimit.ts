/** 与 AGENTS.md / docs 一致：单条同步数据上限 20MB */
export const SYNC_MAX_PAYLOAD_BYTES = 20 * 1024 * 1024;

export function estimateJsonUtf8Bytes(value: unknown): number {
  try {
    const json = JSON.stringify(value);
    return new Blob([json]).size;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function assertSyncPayloadWithinLimit(
  payload: unknown,
  label = '同步数据',
): { ok: true; bytes: number } | { ok: false; bytes: number; message: string } {
  const bytes = estimateJsonUtf8Bytes(payload);
  if (bytes <= SYNC_MAX_PAYLOAD_BYTES) {
    return { ok: true, bytes };
  }
  return {
    ok: false,
    bytes,
    message: `${label}过大（${formatBytes(bytes)}），超过 ${formatBytes(SYNC_MAX_PAYLOAD_BYTES)} 上限。请删除部分书籍后重试。`,
  };
}
