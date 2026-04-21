"use client";

/** 浏览器压缩同步请求体（体积较大时启用） */
async function gzipCompressUtf8(text: string): Promise<ArrayBuffer> {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  }).pipeThrough(new CompressionStream("gzip"));
  return await new Response(stream).arrayBuffer();
}

/** 解析同步 API 响应（支持 Content-Encoding: gzip） */
export async function parseSyncJsonResponse(res: Response): Promise<unknown> {
  const enc = res.headers.get("content-encoding") || "";
  const buf = await res.arrayBuffer();
  if (enc.toLowerCase().includes("gzip")) {
    const ds = new DecompressionStream("gzip");
    const stream = new Response(buf).body!.pipeThrough(ds);
    const text = await new Response(stream).text();
    return JSON.parse(text);
  }
  const text = new TextDecoder().decode(buf);
  return JSON.parse(text);
}

const GZIP_REQUEST_MIN_CHARS = 512;

/** POST JSON；较大时用 gzip 减小上行 */
export async function postSyncJson(
  url: string,
  body: unknown,
  init?: RequestInit
): Promise<Response> {
  const json = JSON.stringify(body);
  const supports =
    typeof CompressionStream !== "undefined" && json.length >= GZIP_REQUEST_MIN_CHARS;

  if (supports) {
    const compressed = await gzipCompressUtf8(json);
    return fetch(url, {
      ...init,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Encoding": "gzip",
        ...(init?.headers as Record<string, string> | undefined),
      },
      body: compressed,
    });
  }

  return fetch(url, {
    ...init,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    },
    body: json,
  });
}
