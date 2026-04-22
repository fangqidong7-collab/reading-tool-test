"use client";

/**
 * POST JSON to a sync API endpoint.
 * Vercel 自动处理 Accept-Encoding 响应压缩，无需手动 gzip。
 */
export async function postSyncJson(
  url: string,
  body: unknown,
  init?: RequestInit
): Promise<Response> {
  return fetch(url, {
    ...init,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    },
    body: JSON.stringify(body),
  });
}

/**
 * 解析同步 API 的 JSON 响应。
 * 浏览器对 Content-Encoding: gzip 的响应自动解压，直接用 res.json() 即可。
 */
export async function parseSyncJsonResponse(res: Response): Promise<unknown> {
  return res.json();
}
