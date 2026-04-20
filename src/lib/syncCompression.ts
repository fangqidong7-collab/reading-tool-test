/** 浏览器 CompressionStream gzip（大包上传显著减小体积） */

export function gzipSupported(): boolean {
  return typeof CompressionStream !== "undefined";
}

/** 将 UTF-8 JSON 字符串压缩为 gzip 二进制 */
export async function gzipUtf8String(json: string): Promise<ArrayBuffer> {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(json));
      controller.close();
    },
  }).pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).arrayBuffer();
}
