/**
 * 大包同步专用：单次请求时间较长，避免沿用浏览器/代理默认短超时；
 * 弱网下自动短暂退避重试。
 */
const DEFAULT_SYNC_TIMEOUT_MS = 180000;
const DEFAULT_SYNC_RETRIES = 2;

export async function fetchWithTimeoutAndRetry(
  url: string,
  init: RequestInit,
  options?: { timeoutMs?: number; retries?: number }
): Promise<Response> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_SYNC_TIMEOUT_MS;
  const retries = options?.retries ?? DEFAULT_SYNC_RETRIES;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
