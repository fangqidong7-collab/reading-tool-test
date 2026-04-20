import { gunzipSync } from "zlib";

/**
 * 解析 POST body：支持 gzip（Content-Encoding: gzip）或明文 JSON。
 * 用于大包同步，避免网关/超时。
 */
export async function parseJsonBodyWithOptionalGzip(request: Request): Promise<unknown> {
  const encoding = request.headers.get("content-encoding")?.toLowerCase();
  const buf = Buffer.from(await request.arrayBuffer());

  /* 可选：限制极端膨胀（约 80MB） */
  const MAX = 80 * 1024 * 1024;
  if (buf.length > MAX) {
    throw new Error("payload too large");
  }

  const text =
    encoding === "gzip" || encoding === "x-gzip"
      ? gunzipSync(buf).toString("utf8")
      : buf.toString("utf8");

  return JSON.parse(text) as unknown;
}
