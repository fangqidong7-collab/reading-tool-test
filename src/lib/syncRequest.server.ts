import { gunzipSync, gzipSync } from "zlib";
import { NextResponse } from "next/server";

/** 解析 POST JSON：支持 Content-Encoding: gzip（由客户端压缩同步负载） */
export async function parseJsonRequestBody(request: Request): Promise<unknown> {
  const enc = request.headers.get("content-encoding") || "";
  const buf = Buffer.from(await request.arrayBuffer());
  const jsonBuf = enc.toLowerCase().includes("gzip") ? gunzipSync(buf) : buf;
  return JSON.parse(jsonBuf.toString("utf-8"));
}

const GZIP_JSON_MIN_BYTES = 2048;

/** 较大 JSON 响应 gzip，减小 pull / push 下行体积 */
export function jsonResponseMaybeGzip(payload: unknown): NextResponse {
  const json = JSON.stringify(payload);
  if (Buffer.byteLength(json, "utf-8") < GZIP_JSON_MIN_BYTES) {
    return NextResponse.json(payload);
  }
  const compressed = gzipSync(Buffer.from(json, "utf-8"));
  return new NextResponse(compressed, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Encoding": "gzip",
    },
  });
}
